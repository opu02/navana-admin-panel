"use client";

import { useEffect, useState } from "react";

export type Me = { userId: number; name: string; email: string; phone: string; roleId: number; roleName: string };

let cached: Me | null = null;

/** The logged-in user (from the ERP login) */
export function useMe() {
  const [me, setMe] = useState<Me | null>(cached);
  useEffect(() => {
    if (cached) return;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) window.location.href = "/login";
        return r.ok ? r.json() : null;
      })
      .then((d: Me | null) => {
        if (d) {
          cached = d;
          setMe(d);
        }
      })
      .catch(() => {});
  }, []);
  return me;
}

export function clearMe() {
  cached = null;
}

export function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "NP";
}
