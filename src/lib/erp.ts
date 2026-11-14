// The ONLY file that talks to the Navana ERP (ORDS) server.
// Field names here match the Flutter app's models exactly.
import "server-only";

export class ErpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function baseUrl() {
  const b = process.env.ERP_BASE_URL;
  if (!b) throw new ErpError(500, "ERP_BASE_URL is missing in .env.local");
  return b.endsWith("/") ? b : b + "/";
}

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

export async function erpFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  if (opts.token !== undefined && !opts.token) {
    throw new ErpError(
      503,
      "The admin panel is not connected to the ERP. Set ERP_SERVICE_USERNAME and ERP_SERVICE_PASSWORD in .env.local and sign in again."
    );
  }
  const url = new URL(path, baseUrl());
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
  } catch {
    throw new ErpError(502, "Could not reach the ERP server. Check your internet or VPN.");
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data as { message?: string } | null)?.message;
    throw new ErpError(res.status, msg ? String(msg) : `ERP error (${res.status})`);
  }
  return data as T;
}

// ORDS paging: { items, hasMore, limit, offset, count }
type Page<T> = { items?: T[]; hasMore?: boolean; limit?: number; offset?: number; count?: number };

/** Load every page of a list endpoint */
export async function erpFetchAll<T>(
  path: string,
  token: string,
  query: Record<string, string | number | undefined> = {},
  pageSize = 500
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (let i = 0; i < 2000; i++) {
    const page = await erpFetch<Page<T>>(path, { token, query: { ...query, offset, limit: pageSize } });
    const items = page?.items ?? [];
    out.push(...items);
    if (!page?.hasMore || items.length === 0) break;
    offset += items.length;
  }
  return out;
}

// ---------------- Types (same as the Flutter app) ----------------
export type ErpLoginResponse = {
  success?: boolean;
  status?: string;
  message?: string;
  user_id?: number;
  name?: string;
  email?: string;
  phone?: string;
  is_active?: string;
  role_id?: number;
  role_name?: string;
  jwt_token?: string;
  access_token?: string;
};

export type ErpBrand = {
  data_id: string;
  brand_id?: string | null;
  brand_name?: string | null;
  form_id?: string | null;
  form_desc?: string | null;
  strength_id?: string | null;
  strength_desc?: string | null;
  generic_id?: string | null;
  generic_name?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  // NOTE: name not confirmed by the ERP team yet. If they use another name, change NPS_FIELD in brand-store.ts
  nps_code?: string | null;
  is_active?: string | null; // "Y" | "N"
  is_sys_data?: string | null; // "Y" = system, "N" = added by a doctor
  last_modified?: string | null;
  uuid?: string | null;
  created_by?: number | null;
  created_at?: string | null;
};

/** Generic, Company, Form, Dose, Duration… all use this shape */
export type ErpNamedItem = {
  data_id: string;
  name_desc?: string | null;
  is_active?: string | null;
  is_sys_data?: string | null;
  last_modified?: string | null;
  uuid?: string | null;
  created_by?: number | null;
  created_at?: string | null;
};

export type ErpPostResult = {
  items?: {
    data_id?: string;
    uuid?: string;
    brand_id?: string;
    form_id?: string;
    strength_id?: string;
    is_success?: string | boolean;
    status?: string;
    message?: string;
  }[];
};

// ---------------- Helpers ----------------
/** Same id format as the app: D{userId}_t{timestamp}_u{uuid with _} */
export function newErpId(userId: number) {
  return `D${userId}_t${Date.now()}_u${crypto.randomUUID().replace(/-/g, "_")}`;
}

/** "2026-06-17T05:05:17Z" (no milliseconds), like the app */
export function erpNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Check the result of a POST that sends { items: [...] } */
export function assertPostOk(res: ErpPostResult) {
  const first = res?.items?.[0];
  const ok =
    first &&
    String(first.status ?? "").toLowerCase() === "success" &&
    String(first.is_success ?? "").toLowerCase() === "true";
  if (!ok) throw new ErpError(502, first?.message || "The ERP did not accept the change.");
  return first!;
}

/** Log in to the ERP (used for ERP users and for the panel's service account) */
export function erpLogin(username: string, password: string) {
  return erpFetch<ErpLoginResponse>("user-auth/login", {
    method: "POST",
    body: { username, password },
    timeoutMs: 30_000,
  });
}
