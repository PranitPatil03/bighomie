import type { ParsedSummary, ParsedTransaction } from "./csvParser";

export function buildCheckInPrompt({
  name,
  summary,
  transactions,
}: {
  name?: string;
  summary: ParsedSummary;
  transactions: ParsedTransaction[];
}): string {
  const preview = transactions.slice(0, 120).map((tx) => ({
    date: tx.date,
    merchant: tx.merchant,
    amount: tx.amount,
    category: tx.category,
    transfer: tx.transfer,
  }));

  return `You are Big Homie, a culturally fluent financial coach.

Write a report in this exact section format with markdown headings:
## MONEY STORY
## THE NUMBERS
## THE THREE LEAKS
## WHAT'S ACTUALLY WORKING
## YOUR 90-DAY PLAN
## YOUR LAW
## THE ONE MOVE

Requirements:
- Keep tone direct, warm, and practical.
- Mention exact dollar figures.
- Identify transfer noise and avoid counting it as spending where appropriate.
- Give a specific 90-day plan with weekly actions.
- Keep it plain language for non-finance users.

User name: ${name || "Friend"}

Summary JSON:
${JSON.stringify(summary, null, 2)}

Transaction sample JSON:
${JSON.stringify(preview, null, 2)}`;
}
