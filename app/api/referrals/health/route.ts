import { NextRequest } from "next/server";
import handler from "./handler";
import { invokeLegacyHandler } from "@/app/api/_utils/nodeHandlerBridge";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return invokeLegacyHandler(handler, request);
}
