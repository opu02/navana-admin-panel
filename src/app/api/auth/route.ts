import { NextResponse } from "next/server";
import { z } from "zod";
import { ErpError, erpLogin, type ErpLoginResponse } from "@/lib/erp";
import { SESSION_COOKIE, SESSION_HOURS, createSession, deleteSession, getSession } from "@/lib/session";
import { verifyLocalAdmin } from "@/lib/local-admins";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(100),
});

// Simple brute-force protection: max 5 tries per minute per IP
const g = globalThis as unknown as { __loginTries?: Map<string, number[]> };
const tries = (g.__loginTries ??= new Map<string, number[]>());
function tooManyTries(ip: string) {
  const now = Date.now();
  const list = (tries.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  tries.set(ip, list);
  return list.length > 5;
}

const WRONG = "Incorrect email or password. Please try again.";
const wrong = () => NextResponse.json({ message: WRONG }, { status: 401 });

function okWithCookie(sessionId: string) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}

function tokenOf(d: ErpLoginResponse) {
  return d.success && d.user_id ? d.access_token || d.jwt_token || "" : "";
}

// POST /api/auth  → login
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (tooManyTries(ip)) {
    return NextResponse.json({ message: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: WRONG }, { status: 400 });
  const { email, password } = parsed.data;

  // ---------- 1) The panel's own admin (data/local-admins.json, bcrypt hash) ----------
  const local = await verifyLocalAdmin(email, password);
  if (local) {
    // The panel admin is not an ERP user, so the server logs in to the ERP
    // with the service account (ERP_SERVICE_USERNAME / ERP_SERVICE_PASSWORD) to load data.
    const su = process.env.ERP_SERVICE_USERNAME;
    const sp = process.env.ERP_SERVICE_PASSWORD;
    if (!su || !sp) {
      console.error("[auth] ERP_SERVICE_USERNAME / ERP_SERVICE_PASSWORD are not set in .env.local");
      return NextResponse.json({ message: "The ERP connection is not set up. Please contact the developer." }, { status: 500 });
    }
    let svc: ErpLoginResponse;
    try {
      svc = await erpLogin(su, sp);
    } catch (e) {
      console.error("[auth] ERP service account login failed:", e instanceof ErpError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ message: "Could not connect to the ERP. Please try again." }, { status: 502 });
    }
    const svcToken = tokenOf(svc);
    if (!svcToken) {
      console.error("[auth] ERP service account login did not return a token — check ERP_SERVICE_USERNAME / ERP_SERVICE_PASSWORD");
      return NextResponse.json({ message: "Could not connect to the ERP. Please contact the developer." }, { status: 502 });
    }
    const s = createSession({
      userId: svc.user_id!, // ERP changes are saved under the service account
      name: local.name, email: local.email, phone: local.phone,
      roleId: 0, roleName: "Panel Admin", erpToken: svcToken, kind: "local",
    });
    return okWithCookie(s.id);
  }

  // ---------- 2) An ERP user (same login as the app) ----------
  let data: ErpLoginResponse;
  try {
    data = await erpLogin(email, password);
  } catch (e) {
    if (e instanceof ErpError && e.status >= 400 && e.status < 500) return wrong();
    const message = e instanceof ErpError ? e.message : "Login failed. Please try again.";
    return NextResponse.json({ message }, { status: 502 });
  }

  const token = tokenOf(data);
  if (!token) return wrong();
  if (data.is_active && data.is_active !== "Y") {
    return NextResponse.json({ message: "This account is not active." }, { status: 403 });
  }

  // Only admin roles may use the admin panel
  const allowed = (process.env.ADMIN_ROLE_IDS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (allowed.length === 0) {
    console.warn(`[auth] ADMIN_ROLE_IDS is empty — allowing role ${data.role_id} (${data.role_name}). Set it before going live!`);
  } else if (!allowed.includes(String(data.role_id))) {
    return NextResponse.json({ message: "You don't have access to the admin panel." }, { status: 403 });
  }

  const s = createSession({
    userId: data.user_id!,
    name: data.name ?? "",
    email: data.email ?? email,
    phone: data.phone ?? "",
    roleId: data.role_id ?? 0,
    roleName: data.role_name ?? "",
    erpToken: token,
    kind: "erp",
  });
  return okWithCookie(s.id);
}

// DELETE /api/auth  → logout
export async function DELETE() {
  const s = await getSession();
  if (s) deleteSession(s.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
