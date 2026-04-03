import { createClient } from "@supabase/supabase-js";
import { assertEnv, env } from "./env";

assertEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
