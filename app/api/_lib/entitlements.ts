import type { ProfileRecord } from "./profile";

export function isProActive(profile: ProfileRecord | null | undefined): boolean {
  return profile?.pro_status === "active" && ["pro_monthly", "pro_annual"].includes(profile?.subscription_tier || "");
}
