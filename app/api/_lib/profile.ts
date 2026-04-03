import { supabaseAdmin } from "./supabaseAdmin";

export type ProfileRecord = {
  id: string;
  full_name?: string | null;
  goal?: string | null;
  is_vet?: boolean | null;
  referral_code?: string | null;
  referral_code_used?: string | null;
  referred_by?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_connect_account_id?: string | null;
  onboarding_completed_at?: string | null;
  pro_status?: string | null;
  subscription_tier?: string | null;
  checkin_credits?: number | null;
  [key: string]: unknown;
};

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as ProfileRecord | null) ?? null;
}

export async function upsertProfile(
  userId: string,
  patch: Partial<ProfileRecord> & Record<string, unknown>,
): Promise<ProfileRecord> {
  const payload = {
    id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as ProfileRecord;
}

export async function findProfileByReferralCode(
  referralCode: string,
): Promise<{ id: string; referral_code: string | null } | null> {
  const normalized = String(referralCode || "").trim().toUpperCase();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", normalized)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as { id: string; referral_code: string | null } | null) ?? null;
}

export async function generateUniqueReferralCode(name: string | undefined, userId: string): Promise<string> {
  const base =
    (name || "HOMIE")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "HOMIE";

  for (let i = 0; i < 12; i += 1) {
    const suffix =
      i === 0 ? userId.slice(0, 4).toUpperCase() : String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${base}${suffix}`;

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  return `${base}${Date.now().toString().slice(-4)}`;
}
