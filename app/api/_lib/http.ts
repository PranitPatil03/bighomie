import type { LegacyRequest, LegacyResponse } from "@/app/api/_utils/legacyTypes";

export function json(res: LegacyResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function error(res: LegacyResponse, status: number, message: string, extras: Record<string, unknown> = {}): void {
  json(res, status, { error: message, ...extras });
}

export function requireMethod(req: LegacyRequest, res: LegacyResponse, method: string): boolean {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    error(res, 405, `Method ${req.method} not allowed`);
    return false;
  }

  return true;
}

export async function readJson(req: LegacyRequest): Promise<Record<string, unknown>> {
  const body = req.body;

  if (body && typeof body === "object" && !Buffer.isBuffer(body) && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return {};

    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf-8").trim();
    if (!text) return {};

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (body instanceof Uint8Array) {
    const text = Buffer.from(body).toString("utf-8").trim();
    if (!text) return {};

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (body instanceof ArrayBuffer) {
    const text = Buffer.from(body).toString("utf-8").trim();
    if (!text) return {};

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return {};
}

export async function readRawBody(req: LegacyRequest): Promise<Buffer> {
  const body = req.body;

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (Buffer.isBuffer(body)) {
    return Buffer.from(body);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  return Buffer.from("");
}

export function getBearerToken(req: LegacyRequest): string {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return "";
  }

  return token;
}
