export type HeaderMap = Record<string, string>;

export type LegacyRequest = {
  method: string;
  headers: HeaderMap;
  query: Record<string, string>;
  url: string;
  body?: unknown;
};

export type LegacyResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (payload?: unknown) => void;
};

export type LegacyHandler = (req: LegacyRequest, res: LegacyResponse) => Promise<void> | void;
