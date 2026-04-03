import { assertEnv, env } from "./env";

assertEnv(["ANTHROPIC_API_KEY"]);

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

type ClaudeBlock = {
  text?: string;
};

type ClaudeResponse = {
  content?: ClaudeBlock[];
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
  };
};

export async function callAnthropic({
  system,
  messages,
  maxTokens = 1200,
}: {
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<{ text: string; usage: Record<string, unknown> | null }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  });

  const payload = (await response.json()) as ClaudeResponse;

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Anthropic request failed");
  }

  const text = (payload?.content || [])
    .map((block) => block?.text || "")
    .join("")
    .trim();

  return {
    text,
    usage: payload?.usage || null,
  };
}
