import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { requireUser } from "@/app/api/_lib/auth";
import { isProActive } from "@/app/api/_lib/entitlements";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readJson, requireMethod } from "@/app/api/_lib/http";
import {
  findProfileByReferralCode,
  generateUniqueReferralCode,
  getProfile,
  upsertProfile,
} from "@/app/api/_lib/profile";

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }
    const user = auth.user;

    const body = await readJson(req);

    const name = typeof body.name === "string" ? body.name : undefined;
    const goal = typeof body.goal === "string" ? body.goal : undefined;
    const isVet = typeof body.isVet === "boolean" ? body.isVet : undefined;
    const referralCode = typeof body.referralCode === "string" ? body.referralCode : undefined;

    const existing = await getProfile(user.id);

    let resolvedReferralCode = existing?.referral_code || undefined;
    if (!resolvedReferralCode) {
      resolvedReferralCode = await generateUniqueReferralCode(name, user.id);
    }

    const incomingCode =
      String(referralCode || user.user_metadata?.referral_code_used || "")
        .trim()
        .toUpperCase() || null;

    let referredBy = existing?.referred_by || null;
    if (!referredBy && incomingCode) {
      const referredProfile = await findProfileByReferralCode(incomingCode);
      if (referredProfile?.id && referredProfile.id !== user.id) {
        referredBy = referredProfile.id;
      }
    }

    const profile = await upsertProfile(user.id, {
      full_name: name || existing?.full_name || "",
      goal: goal || existing?.goal || "",
      is_vet: typeof isVet === "boolean" ? isVet : Boolean(existing?.is_vet),
      referral_code: resolvedReferralCode,
      referral_code_used: incomingCode || existing?.referral_code_used || null,
      referred_by: referredBy,
      onboarding_completed_at: new Date().toISOString(),
    });

    return json(res, 200, {
      profile,
      entitlements: {
        isPro: isProActive(profile),
        checkinCredits: Number(profile.checkin_credits || 0),
      },
    });
  } catch (caughtError: unknown) {
    const message = errorMessage(caughtError, "Failed to save onboarding");
    if (message.includes("Could not find the table 'public.profiles'")) {
      return error(
        res,
        500,
        "Database schema is not initialized. Run supabase/schema.sql in the Supabase SQL editor.",
      );
    }
    return error(res, 500, message);
  }
};

export default handler;
