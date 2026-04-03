import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { callAnthropic } from "@/app/api/_lib/anthropic";
import { requireUser } from "@/app/api/_lib/auth";
import { parseTransactionsCsv, type ParsedCsvResult } from "@/app/api/_lib/csvParser";
import { isProActive } from "@/app/api/_lib/entitlements";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readJson, requireMethod } from "@/app/api/_lib/http";
import { getProfile, upsertProfile } from "@/app/api/_lib/profile";
import { buildCheckInPrompt } from "@/app/api/_lib/prompts";
import { supabaseAdmin } from "@/app/api/_lib/supabaseAdmin";

function fallbackSummary(rawData: string): ParsedCsvResult {
  const lines = String(rawData || "")
    .split("\n")
    .slice(0, 300)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    transactions: [],
    summary: {
      count: lines.length,
      income: 0,
      expenses: 0,
      byCategory: {},
      topCategories: [],
      transfers: [],
      notes: "Structured CSV parse failed; using raw statement text.",
      rawPreview: lines.slice(0, 40),
    },
  };
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
    const rawData = typeof body.rawData === "string" ? body.rawData : "";
    const name = typeof body.name === "string" ? body.name : undefined;

    if (!rawData) {
      return error(res, 400, "rawData is required");
    }

    const profile = await getProfile(user.id);
    const credits = Number(profile?.checkin_credits || 0);
    const proUser = isProActive(profile);

    if (!proUser && credits < 1) {
      return error(res, 402, "Check In payment required before analysis");
    }

    let parsed: ParsedCsvResult;
    try {
      parsed = parseTransactionsCsv(rawData);
    } catch {
      parsed = fallbackSummary(rawData);
    }

    const prompt = buildCheckInPrompt({
      name,
      summary: parsed.summary,
      transactions: parsed.transactions,
    });

    const result = await callAnthropic({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2600,
    });

    if (!result.text) {
      return error(res, 502, "No report returned by AI provider");
    }

    await supabaseAdmin.from("checkins").insert({
      user_id: user.id,
      report_text: result.text,
      summary_json: parsed.summary,
      transaction_count: parsed.summary.count || 0,
    });

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_checkin_completed_at: nowIso,
    };

    if (!proUser) {
      patch.checkin_credits = Math.max(0, credits - 1);
    }

    await upsertProfile(user.id, patch);

    if (profile?.referred_by) {
      const { data: existingReferral } = await supabaseAdmin
        .from("referrals")
        .select("id")
        .eq("referred_user_id", user.id)
        .maybeSingle();

      if (!existingReferral) {
        const pendingUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from("referrals").insert({
          referrer_user_id: profile.referred_by,
          referred_user_id: user.id,
          referral_code: profile.referral_code_used || null,
          amount_cents: 100,
          status: "pending",
          pending_until: pendingUntil,
        });
      }
    }

    return json(res, 200, {
      report: result.text,
      parsedSummary: parsed.summary,
      remainingCredits: proUser ? credits : Math.max(0, credits - 1),
      proActive: proUser,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "Check In analysis failed"));
  }
};

export default handler;
