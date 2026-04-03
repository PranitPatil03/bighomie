import type { User } from "@supabase/supabase-js";
import type { LegacyRequest } from "@/app/api/_utils/legacyTypes";
import { getBearerToken } from "./http";
import { supabaseAdmin } from "./supabaseAdmin";

type RequireUserResult =
  | { ok: true; user: User }
  | { ok: false; error: string };

export async function requireUser(req: LegacyRequest): Promise<RequireUserResult> {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return { ok: false, error: "Missing bearer token" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { ok: false, error: "Invalid or expired session" };
  }

  return { ok: true, user: data.user };
}
