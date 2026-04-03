import Stripe from "stripe";
import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { env } from "@/app/api/_lib/env";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readRawBody, requireMethod } from "@/app/api/_lib/http";
import { getProfile, upsertProfile } from "@/app/api/_lib/profile";
import { planFromPriceId, stripe } from "@/app/api/_lib/stripe";
import { supabaseAdmin } from "@/app/api/_lib/supabaseAdmin";

type Plan = "checkin" | "pro" | "annual" | "unknown";

function extractId(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }

  return "";
}

function readMetadataValue(metadata: Record<string, string> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function readInvoiceParentUserId(invoice: Stripe.Invoice): string {
  const parent = invoice.parent;
  if (!parent || typeof parent !== "object") return "";

  const parentInfo = parent as {
    subscription_details?: {
      metadata?: Record<string, string>;
    };
  };

  return readMetadataValue(parentInfo.subscription_details?.metadata, "app_user_id");
}

function readInvoiceLinePriceId(line: Stripe.InvoiceLineItem | undefined): string {
  if (!line || typeof line !== "object") return "";

  const candidate = line as { price?: { id?: string } };
  return typeof candidate.price?.id === "string" ? candidate.price.id : "";
}

async function resolveUserIdFromCustomer(customerId: string): Promise<string> {
  if (!customerId) return "";

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const result = data as { id?: string } | null;
  return result?.id || "";
}

async function setSubscriptionStatus({
  userId,
  customerId,
  subscriptionId,
  plan,
  status,
  addCredits = 0,
}: {
  userId: string;
  customerId: string;
  subscriptionId: string;
  plan: Plan;
  status: "active" | "inactive" | "canceled";
  addCredits?: number;
}): Promise<void> {
  if (!userId) return;

  const profile = await getProfile(userId);
  const currentCredits = Number(profile?.checkin_credits || 0);

  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId || profile?.stripe_customer_id || null,
    stripe_subscription_id: subscriptionId || profile?.stripe_subscription_id || null,
  };

  if (plan === "checkin") {
    patch.checkin_credits = currentCredits + 1;
    patch.last_checkin_payment_at = new Date().toISOString();
  }

  if (plan === "pro") {
    patch.subscription_tier = "pro_monthly";
    patch.pro_status = status;
    patch.checkin_credits = currentCredits + addCredits;
  }

  if (plan === "annual") {
    patch.subscription_tier = "pro_annual";
    patch.pro_status = status;
    patch.checkin_credits = currentCredits + addCredits;
  }

  if (status === "canceled") {
    patch.pro_status = "canceled";
  }

  await upsertProfile(userId, patch);
}

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return error(res, 500, "Missing STRIPE_WEBHOOK_SECRET");
  }

  try {
    const payload = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return error(res, 400, "Missing stripe-signature header");
    }

    const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const plan = readMetadataValue(metadata, "plan") as Plan;
        const userId =
          readMetadataValue(metadata, "app_user_id") ||
          (await resolveUserIdFromCustomer(extractId(session.customer)));

        await setSubscriptionStatus({
          userId,
          customerId: extractId(session.customer),
          subscriptionId: extractId(session.subscription),
          plan,
          status: "active",
          addCredits: plan === "pro" ? 1 : plan === "annual" ? 2 : 0,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const line = invoice.lines?.data?.[0];
        const plan = planFromPriceId(readInvoiceLinePriceId(line));

        const userId =
          readMetadataValue(invoice.metadata, "app_user_id") ||
          readInvoiceParentUserId(invoice) ||
          (await resolveUserIdFromCustomer(extractId(invoice.customer)));

        if (plan === "pro" || plan === "annual") {
          await setSubscriptionStatus({
            userId,
            customerId: extractId(invoice.customer),
            subscriptionId: "",
            plan,
            status: "active",
            addCredits: plan === "pro" ? 1 : 2,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = planFromPriceId(subscription.items?.data?.[0]?.price?.id);

        const userId =
          readMetadataValue(subscription.metadata, "app_user_id") ||
          (await resolveUserIdFromCustomer(extractId(subscription.customer)));

        const isActive = ["active", "trialing", "past_due"].includes(subscription.status);

        await setSubscriptionStatus({
          userId,
          customerId: extractId(subscription.customer),
          subscriptionId: extractId(subscription.id),
          plan,
          status: isActive ? "active" : "inactive",
          addCredits: 0,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = planFromPriceId(subscription.items?.data?.[0]?.price?.id);

        const userId =
          readMetadataValue(subscription.metadata, "app_user_id") ||
          (await resolveUserIdFromCustomer(extractId(subscription.customer)));

        await setSubscriptionStatus({
          userId,
          customerId: extractId(subscription.customer),
          subscriptionId: extractId(subscription.id),
          plan,
          status: "canceled",
          addCredits: 0,
        });
        break;
      }

      default:
        break;
    }

    return json(res, 200, { received: true });
  } catch (caughtError: unknown) {
    return error(res, 400, `Webhook error: ${errorMessage(caughtError, "Unknown error")}`);
  }
};

export default handler;
