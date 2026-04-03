import { NextRequest, NextResponse } from "next/server";
import type { HeaderMap, LegacyHandler, LegacyRequest, LegacyResponse } from "./legacyTypes";

type BridgeOptions = {
  rawBody?: boolean;
};

function headersToObject(request: NextRequest): HeaderMap {
  const values: HeaderMap = {};
  request.headers.forEach((value, key) => {
    values[key.toLowerCase()] = value;
  });
  return values;
}

class ResponseCapture implements LegacyResponse {
  statusCode = 200;

  private readonly headerStore = new Map<string, string>();

  payload: unknown = "";

  setHeader(name: string, value: string): void {
    this.headerStore.set(name, value);
  }

  end(payload?: unknown): void {
    this.payload = payload ?? "";
  }

  toHeaders(): Headers {
    const headers = new Headers();
    this.headerStore.forEach((value, key) => headers.set(key, value));
    return headers;
  }
}

async function parseBody(request: NextRequest, options?: BridgeOptions): Promise<unknown> {
  if (options?.rawBody) {
    return Buffer.from(await request.arrayBuffer());
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }

  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  return await request.text();
}

function toResponseBody(payload: unknown, headers: Headers): BodyInit {
  if (payload instanceof Uint8Array) {
    return Buffer.from(payload).toString("utf-8");
  }

  if (payload instanceof ArrayBuffer || typeof payload === "string") {
    return payload;
  }

  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  if (Buffer.isBuffer(payload)) {
    return new Uint8Array(payload);
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(payload ?? {});
}

export async function invokeLegacyHandler(
  handler: LegacyHandler,
  request: NextRequest,
  options?: BridgeOptions,
): Promise<NextResponse> {
  const req: LegacyRequest = {
    method: request.method,
    headers: headersToObject(request),
    query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    url: request.url,
    body: await parseBody(request, options),
  };

  const res = new ResponseCapture();
  await handler(req, res);

  const headers = res.toHeaders();
  const body = toResponseBody(res.payload, headers);

  return new NextResponse(body, {
    status: res.statusCode,
    headers,
  });
}
