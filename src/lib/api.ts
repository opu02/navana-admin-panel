import "server-only";
import { NextResponse } from "next/server";
import { ErpError } from "./erp";
import { SESSION_COOKIE, UnauthorizedError, deleteSession, getSession } from "./session";

export function jsonError(status: number, message: string) {
  const res = NextResponse.json({ message }, { status });
  // a 401 means the session is gone → clear the cookie so the login page works again
  if (status === 401) res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** Wrap every API route: turns errors into clean JSON (never shows server details) */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UnauthorizedError) return jsonError(401, "Please sign in again.");
    if (e instanceof ErpError) {
      if (e.status === 401 || e.status === 403) {
        const s = await getSession();
        if (s) deleteSession(s.id);
        return jsonError(401, "Your session has expired. Please sign in again.");
      }
      console.error("[ERP]", e.status, e.message);
      return jsonError(502, e.message);
    }
    console.error(e);
    return jsonError(500, "Something went wrong. Please try again.");
  }
}
