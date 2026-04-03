import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { requireUser } from "@/app/api/_lib/auth";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readJson, requireMethod } from "@/app/api/_lib/http";
import { getProfile } from "@/app/api/_lib/profile";
import { stripe } from "@/app/api/_lib/stripe";
import { supabaseAdmin } from "@/app/api/_lib/supabaseAdmin";

type AvailableReferral = {
  id: string;
  amount_cents: number | null;
};

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }
    const user = auth.user;

    const profile = await getProfile(user.id);
    if (!profile?.stripe_connect_account_id) {
      return error(res, 400, "Connect Stripe account before cashing out");
    }

    await supabaseAdmin
      .from("referrals")
      .update({ status: "available" })
      .eq("referrer_user_id", user.id)
      .eq("status", "pending")
      .lte("pending_until", new Date().toISOString());

    const { data, error: availableError } = await supabaseAdmin
      .from("referrals")
      .select("id, amount_cents")
      .eq("referrer_user_id", user.id)
      .eq("status", "available")
      .order("created_at", { ascending: true });

    if (availableError) throw availableError;

    const availableReferrals = (data || []) as AvailableReferral[];

    const totalAvailable = availableReferrals.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);

    const body = await readJson(req);
    const requestedDollars = Number(body.amount || totalAvailable / 100);
    const requestedCents = Math.round(requestedDollars * 100);

    if (requestedCents < 500) {
      return error(res, 400, "Minimum cashout is $5.00");
    }

    if (requestedCents > totalAvailable) {
      return error(res, 400, "Requested cashout exceeds available balance");
    }

    let running = 0;
    const selected: string[] = [];
    for (const row of availableReferrals) {
      if (running >= requestedCents) break;
      running += Number(row.amount_cents || 0);
      selected.push(row.id);
    }

    if (!selected.length) {
      return error(res, 400, "No available referrals to cash out");
    }

    const transfer = await stripe.transfers.create({
      amount: requestedCents,
      currency: "usd",
      destination: profile.stripe_connect_account_id,
      metadata: {
        app_user_id: user.id,
        source: "big_homie_referral_cashout",
      },
    });

    await supabaseAdmin
      .from("referrals")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_transfer_id: transfer.id,
      })
      .in("id", selected);

    return json(res, 200, {
      transferId: transfer.id,
      amount: requestedCents / 100,
      paidReferralCount: selected.length,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "Cashout failed"));
  }
};

export default handler;
