import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { requireUser } from "@/app/api/_lib/auth";
import { env } from "@/app/api/_lib/env";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, requireMethod } from "@/app/api/_lib/http";
import { getProfile, upsertProfile } from "@/app/api/_lib/profile";
import { stripe } from "@/app/api/_lib/stripe";

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }
    const user = auth.user;

    const profile = await getProfile(user.id);
    let accountId = profile?.stripe_connect_account_id || undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        metadata: {
          app_user_id: user.id,
        },
      });
      accountId = account.id;
      await upsertProfile(user.id, { stripe_connect_account_id: accountId });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${env.APP_URL}/?connect=retry`,
      return_url: `${env.APP_URL}/?connect=success`,
      type: "account_onboarding",
    });

    return json(res, 200, {
      accountId,
      onboardingUrl: link.url,
      expiresAt: link.expires_at,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "Failed to initialize Stripe Connect"));
  }
};

export default handler;
