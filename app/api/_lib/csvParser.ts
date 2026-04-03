import { parse as parseCsv } from "csv-parse/sync";

const TRANSFER_PATTERNS = [
  "TRANSFER",
  "ZELLE",
  "VENMO",
  "CASH APP",
  "CASHAPP",
  "CHIME",
  "PAYPAL",
  "P2P",
  "APPLE CASH",
];

const CATEGORY_RULES = [
  { category: "Rent/Housing", keys: ["RENT", "APARTMENT", "MORTGAGE", "PROPERTY MGMT"] },
  { category: "Groceries", keys: ["WALMART", "KROGER", "ALDI", "SAFEWAY", "TRADER JOE", "COSTCO"] },
  { category: "Food", keys: ["DOORDASH", "UBEREATS", "MCDONALD", "CHICK", "STARBUCKS", "RESTAURANT"] },
  { category: "Transportation", keys: ["SHELL", "CHEVRON", "EXXON", "UBER", "LYFT", "GAS"] },
  { category: "Bills", keys: ["COMCAST", "AT&T", "VERIZON", "T-MOBILE", "INSURANCE", "UTILITY"] },
  { category: "Income", keys: ["PAYROLL", "DIRECT DEP", "DIRECT DEPOSIT", "SALARY", "PAYCHECK"] },
  { category: "Entertainment", keys: ["NETFLIX", "HULU", "SPOTIFY", "AMAZON PRIME", "XBOX", "PLAYSTATION"] },
];

type CsvRow = Record<string, string | number | null | undefined>;

export type ParsedTransaction = {
  id: string;
  date: string | null;
  merchant: string;
  amount: number;
  category: string;
  transfer: boolean;
};

export type ParsedSummary = {
  count: number;
  income: number;
  expenses: number;
  byCategory: Record<string, number>;
  transfers: Array<{ date: string | null; merchant: string; amount: number }>;
  topCategories: Array<{ category: string; total: number }>;
  notes?: string;
  rawPreview?: string[];
};

export type ParsedCsvResult = {
  transactions: ParsedTransaction[];
  summary: ParsedSummary;
};

function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const text = String(raw).trim();
  if (!text) return 0;

  const normalized = text
    .replace(/[$,]/g, "")
    .replace(/\((.*?)\)/, "-$1")
    .replace(/\s+/g, "");

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function pick(record: CsvRow, candidates: string[]): unknown {
  const keys = Object.keys(record);
  for (const candidate of candidates) {
    const found = keys.find((key) => key.toLowerCase().trim() === candidate);
    if (found) return record[found];
  }
  return "";
}

function cleanMerchant(raw: unknown): string {
  const merchant = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/\d{4,}/g, "")
    .replace(/POS DEBIT|DEBIT CARD PURCHASE|ONLINE TRANSFER|CHECKCARD|ACH DEBIT|ACH CREDIT/gi, "")
    .trim();

  return merchant.slice(0, 80) || "Unknown";
}

function detectTransfer(merchant: string): boolean {
  const upper = merchant.toUpperCase();
  return TRANSFER_PATTERNS.some((key) => upper.includes(key));
}

function classify(merchant: string, amount: number): string {
  if (amount > 0) return "Income";

  const upper = merchant.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((key) => upper.includes(key))) {
      return rule.category;
    }
  }

  if (detectTransfer(merchant)) return "Transfer";
  return "Other";
}

function normalizeDate(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function parseTransactionsCsv(rawData: string): ParsedCsvResult {
  const records = parseCsv(rawData, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as CsvRow[];

  const transactions: ParsedTransaction[] = records
    .map((row, index) => {
      const date = normalizeDate(pick(row, ["date", "posting date", "transaction date", "posted date", "trans date"]));
      const description = pick(row, ["description", "merchant", "name", "transaction description", "memo"]);

      const debit = parseAmount(pick(row, ["debit", "withdrawal", "money out"]));
      const credit = parseAmount(pick(row, ["credit", "deposit", "money in"]));
      const amountRaw = pick(row, ["amount", "transaction amount", "value"]);

      let amount = parseAmount(amountRaw);
      if (!amount && debit) amount = -Math.abs(debit);
      if (!amount && credit) amount = Math.abs(credit);

      const merchant = cleanMerchant(description);
      const transfer = detectTransfer(merchant);
      const category = classify(merchant, amount);

      return {
        id: `${date || "row"}-${index}`,
        date,
        merchant,
        amount,
        category,
        transfer,
      };
    })
    .filter((transaction) => transaction.amount !== 0)
    .slice(0, 5000);

  const summary: ParsedSummary = {
    count: transactions.length,
    income: 0,
    expenses: 0,
    byCategory: {},
    transfers: [],
    topCategories: [],
  };

  for (const tx of transactions) {
    if (tx.amount > 0) summary.income += tx.amount;
    if (tx.amount < 0) summary.expenses += Math.abs(tx.amount);

    summary.byCategory[tx.category] = (summary.byCategory[tx.category] || 0) + Math.abs(tx.amount);

    if (tx.transfer) {
      summary.transfers.push({
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
      });
    }
  }

  summary.topCategories = Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, total]) => ({ category, total }));

  return { transactions, summary };
}
