import type { LegacyHandler } from "@/app/api/_utils/legacyTypes";
import { callAnthropic } from "@/app/api/_lib/anthropic";
import { requireUser } from "@/app/api/_lib/auth";
import { errorMessage } from "@/app/api/_lib/errors";
import { error, json, readJson, requireMethod } from "@/app/api/_lib/http";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const item = value as { role?: unknown; content?: unknown };
  return (item.role === "user" || item.role === "assistant") && typeof item.content === "string";
}

const handler: LegacyHandler = async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return error(res, 401, auth.error);
    }

    const body = await readJson(req);
    const messagesRaw = body.messages;

    if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
      return error(res, 400, "messages array is required");
    }

    const messages = messagesRaw.filter(isChatMessage);
    if (messages.length === 0) {
      return error(res, 400, "messages must contain valid chat message objects");
    }

    const system = typeof body.system === "string" ? body.system : undefined;
    const maxTokens = Math.min(Number(body.maxTokens) || 1000, 3000);

    const result = await callAnthropic({
      system,
      messages,
      maxTokens,
    });

    return json(res, 200, {
      reply: result.text,
      usage: result.usage,
    });
  } catch (caughtError: unknown) {
    return error(res, 500, errorMessage(caughtError, "AI chat failed"));
  }
};

export default handler;
