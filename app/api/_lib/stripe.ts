import Stripe from "stripe";
import { assertEnv, env } from "./env";

assertEnv([
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_CHECKIN_ONE_TIME",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
]);

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export function planFromPriceId(priceId: string | undefined | null): "checkin" | "pro" | "annual" | "unknown" {
  if (priceId === env.STRIPE_PRICE_CHECKIN_ONE_TIME) return "checkin";
  if (priceId === env.STRIPE_PRICE_PRO_MONTHLY) return "pro";
  if (priceId === env.STRIPE_PRICE_PRO_ANNUAL) return "annual";
  return "unknown";
}
