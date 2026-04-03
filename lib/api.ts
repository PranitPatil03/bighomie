type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiRequestOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  accessToken?: string;
};

type ErrorPayload = {
  error?: string;
  message?: string;
};

class ApiError extends Error {
  status: number;

  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE = "";

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
  const { method = "GET", body, accessToken } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const typedPayload = payload as ErrorPayload;
    throw new ApiError(typedPayload.error ?? typedPayload.message ?? "Request failed", response.status, payload);
  }

  return payload as TResponse;
}

type CheckoutPlan = "checkin" | "pro" | "annual";

type CheckoutSessionResponse = {
  url: string;
  sessionId: string;
};

export async function createCheckoutSession(plan: CheckoutPlan, accessToken: string): Promise<CheckoutSessionResponse> {
  return apiRequest<CheckoutSessionResponse, { plan: CheckoutPlan }>("/api/payments/create-checkout-session", {
    method: "POST",
    accessToken,
    body: { plan },
  });
}

type OnboardingPayload = {
  name?: string;
  goal?: string;
  isVet?: boolean;
  referralCode?: string;
};

type OnboardingResponse = {
  profile: Record<string, unknown>;
  entitlements: {
    isPro: boolean;
    checkinCredits: number;
  };
};

export async function saveOnboarding(payload: OnboardingPayload, accessToken: string): Promise<OnboardingResponse> {
  return apiRequest<OnboardingResponse, OnboardingPayload>("/api/onboarding/save", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

type ChatPayload = {
  messages: Array<{ role: string; content: string }>;
  system?: string;
  maxTokens?: number;
};

type ChatResponse = {
  reply: string;
  usage?: Record<string, unknown>;
};

export async function chatWithBigHomie(payload: ChatPayload, accessToken: string): Promise<ChatResponse> {
  return apiRequest<ChatResponse, ChatPayload>("/api/ai/chat", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

type CheckInResponse = {
  report: string;
  parsedSummary: Record<string, unknown>;
  remainingCredits: number;
  proActive: boolean;
};

export async function runCheckInAnalysis(
  payload: { rawData: string; name?: string },
  accessToken: string,
): Promise<CheckInResponse> {
  return apiRequest<CheckInResponse, { rawData: string; name?: string }>("/api/checkin/analyze", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

type ReferralStatsResponse = {
  totals: {
    total: number;
    pending: number;
    available: number;
    paid: number;
  };
  referrals: Array<Record<string, unknown>>;
};

export async function getReferralStats(accessToken: string): Promise<ReferralStatsResponse> {
  return apiRequest<ReferralStatsResponse>("/api/referrals/stats", {
    method: "GET",
    accessToken,
  });
}

type ConnectOnboardingResponse = {
  accountId: string;
  onboardingUrl: string;
  expiresAt: number;
};

export async function createStripeConnectOnboarding(accessToken: string): Promise<ConnectOnboardingResponse> {
  return apiRequest<ConnectOnboardingResponse>("/api/referrals/create-connect-account", {
    method: "POST",
    accessToken,
  });
}

type CashoutResponse = {
  transferId: string;
  amount: number;
  paidReferralCount: number;
};

export async function requestReferralCashout(
  body: { amount: number },
  accessToken: string,
): Promise<CashoutResponse> {
  return apiRequest<CashoutResponse, { amount: number }>("/api/referrals/cashout", {
    method: "POST",
    accessToken,
    body,
  });
}
