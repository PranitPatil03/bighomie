import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { requireUser } from "@/app/api/_lib/auth";
import { env } from "@/app/api/_lib/env";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readJson, requireMethod } from "@/app/api/_lib/http";
import { getProfile, upsertProfile } from "@/app/api/_lib/profile";
import { stripe } from "@/app/api/_lib/stripe";

type Plan = "checkin" | "pro" | "annual";

const PLAN_CONFIG: Record<Plan, { mode: "payment" | "subscription"; priceId: string }> = {
  checkin: { mode: "payment", priceId: env.STRIPE_PRICE_CHECKIN_ONE_TIME },
  pro: { mode: "subscription", priceId: env.STRIPE_PRICE_PRO_MONTHLY },
  annual: { mode: "subscription", priceId: env.STRIPE_PRICE_PRO_ANNUAL },
};

function isPlan(value: string): value is Plan {
  return value === "checkin" || value === "pro" || value === "annual";
}

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }
    const user = auth.user;

    const body = await readJson(req);
    const planValue = typeof body.plan === "string" ? body.plan : "";

    if (!isPlan(planValue)) {
      return error(res, 400, "Unsupported plan");
    }

    const config = PLAN_CONFIG[planValue];

    const profile = await getProfile(user.id);
    let customerId = profile?.stripe_customer_id || undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          app_user_id: user.id,
        },
      });
      customerId = customer.id;
      await upsertProfile(user.id, { stripe_customer_id: customerId });
    }

    const successUrl = `${env.APP_URL}/?checkout=success&plan=${planValue}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.APP_URL}/?checkout=cancel&plan=${planValue}`;

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      customer: customerId,
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        app_user_id: user.id,
        plan: planValue,
      },
      ...(config.mode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                app_user_id: user.id,
                plan: planValue,
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                app_user_id: user.id,
                plan: planValue,
              },
            },
          }),
    });

    return json(res, 200, {
      url: session.url || "",
      sessionId: session.id,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "Failed to create checkout session"));
  }
};

export default handler;
