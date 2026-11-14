"use client";

/** fetch() for our own /api routes. On 401 it sends the user to the login page. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError(401, body?.message ?? "Please sign in again.");
  }
  if (!res.ok) throw new ApiError(res.status, body?.message ?? "Something went wrong.");
  return body as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
