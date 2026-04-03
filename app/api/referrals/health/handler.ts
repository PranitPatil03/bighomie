import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { json, requireMethod } from "@/app/api/_lib/http";

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "GET")) return;
  return json(res, 200, { ok: true, service: "referrals" });
};

export default handler;
