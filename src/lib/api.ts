import { toast } from "sonner";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ||
  "https://anixraksha-backend.onrender.com";

export const TOKEN_KEY = "ww_token";
export const ROLE_KEY = "ww_role";

export type Envelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function friendlyMessage(status: number, message?: string) {
  switch (status) {
    case 401:
      return "Your session expired. Please sign in again.";
    case 403:
      return "You don't have access to this.";
    case 409:
      return message || "That conflicts with an existing record.";
    case 422:
      return message || "Please check the values you entered.";
    case 503:
      return "Service temporarily unavailable. Try again shortly.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

type Options = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  silent?: boolean;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, silent = false } = opts;

  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    if (!silent) toast.error("Cannot reach the WaterWatch API.");
    throw new ApiError(0, "NETWORK", "Cannot reach the WaterWatch API.");
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.success) {
    const code = payload?.error?.code ?? String(res.status);
    const message = friendlyMessage(res.status, payload?.error?.message);
    if (res.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    if (!silent) toast.error(message);
    throw new ApiError(res.status, code, message);
  }

  return payload.data as T;
}
