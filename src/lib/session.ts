// Login sessions. The browser only gets a random session id (httpOnly cookie).
// The ERP token stays on our server and is never sent to the browser.
import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export type Session = {
  id: string;
  userId: number;
  name: string;
  email: string;
  phone: string;
  roleId: number;
  roleName: string;
  erpToken: string;
  kind: "erp" | "local"; // "local" = panel-only admin (uses the ERP service account for data)
  expiresAt: number;
};

export const SESSION_COOKIE = "access_token";
export const SESSION_HOURS = 8;

// Kept on globalThis so it survives hot reload in development.
// NOTE: sessions are in memory → restarting the server logs everyone out.
const g = globalThis as unknown as { __sessions?: Map<string, Session> };
const store = (g.__sessions ??= new Map<string, Session>());

export class UnauthorizedError extends Error {}

export function createSession(data: Omit<Session, "id" | "expiresAt">): Session {
  const id = randomBytes(32).toString("hex");
  const s: Session = { ...data, id, expiresAt: Date.now() + SESSION_HOURS * 3600_000 };
  store.set(id, s);
  return s;
}

export async function getSession(): Promise<Session | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const s = store.get(id);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return s;
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export function deleteSession(id: string) {
  store.delete(id);
}

/** Update the logged-in user's details after a profile change */
export function patchSession(id: string, data: Partial<Pick<Session, "name" | "email" | "phone">>) {
  const s = store.get(id);
  if (s) store.set(id, { ...s, ...data });
}
