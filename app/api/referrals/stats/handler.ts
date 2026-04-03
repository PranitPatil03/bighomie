import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { requireUser } from "@/app/api/_lib/auth";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, requireMethod } from "@/app/api/_lib/http";
import { supabaseAdmin } from "@/app/api/_lib/supabaseAdmin";

type ReferralRow = {
  id: string;
  amount_cents: number | null;
  status: string | null;
  pending_until: string | null;
  paid_at: string | null;
  created_at: string | null;
};

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "GET")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }
    const user = auth.user;

    await supabaseAdmin
      .from("referrals")
      .update({ status: "available" })
      .eq("referrer_user_id", user.id)
      .eq("status", "pending")
      .lte("pending_until", new Date().toISOString());

    const { data, error: referralsError } = await supabaseAdmin
      .from("referrals")
      .select("id, amount_cents, status, pending_until, paid_at, created_at")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (referralsError) throw referralsError;

    const referrals = (data || []) as ReferralRow[];

    const amounts = referrals.reduce(
      (acc, row) => {
        const dollars = Number(row.amount_cents || 0) / 100;
        acc.total += dollars;
        if (row.status === "pending") acc.pending += dollars;
        if (row.status === "available") acc.available += dollars;
        if (row.status === "paid") acc.paid += dollars;
        return acc;
      },
      { total: 0, pending: 0, available: 0, paid: 0 },
    );

    return json(res, 200, {
      totals: amounts,
      referrals,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "Unable to load referral stats"));
  }
};

export default handler;
