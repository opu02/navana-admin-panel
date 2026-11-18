// Doctors that live in the ERP, for the Doctor List page.
//   GET rx-data/user-create                 → every user (role 1 = System Admin, role 2 = Doctor), one call, no NPL in it
//   GET rx-data/rx-doctor-chamber?user_id=  → the chambers of ONE doctor (this is where the NPL / doc_code is)
// So the list = 1 call for the users + 1 call per doctor for the chambers. The result is cached (see TTL)
// so this heavy load only happens once in a while, not on every page open.
import "server-only";
import { ErpError, erpFetch } from "./erp";
import type { Session } from "./session";
import { padNpl } from "./user-schema";
import { UserDuplicate } from "./user-store";

export type ErpUserRow = {
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  phone_no?: string | null;
  role_id?: number | null;
  role_name?: string | null;
  created_at?: string | null;
  is_active?: string | null; // "Y" | "N"
};

export type ErpChamberRow = {
  chamber_id: number;
  user_id?: number | null;
  doc_code?: string | null;
  chamber_name?: string | null;
  chamber_address?: string | null;
};

export type ListedChamber = {
  chamberId: number; docCode: string; chamberName: string; chamberAddress: string; erpStatus: "synced";
};

/** Same shape the Doctor List screen already uses for website users */
export type ListedDoctor = {
  id: string; // "erp-<user_id>"
  erpUserId: number;
  name: string; email: string; username: string; type: "Doctor";
  designation: string; organization: string; specialty: string; npl: string; bmdc: string; chamber: string;
  isActive: boolean; createdAt: string; erpStatus: "synced";
  chambers: ListedChamber[];
};

type Entry = { at: number; users: ErpUserRow[]; chambers: Map<number, ErpChamberRow[]>; failed: number };

const TTL_MS = 15 * 60_000; // how long the loaded list is reused
const CONCURRENCY = 8; // chamber requests sent to the ERP at the same time
const cache = new Map<number, Entry>(); // key: the ERP user id of the session
const inflight = new Map<number, Promise<Entry>>();

export const isErpDoctor = (u: ErpUserRow) => u.role_id === 2 || /^doctor$/i.test((u.role_name ?? "").trim());

/** Every user from the ERP (ORDS pages are followed if the ERP ever starts paging) */
async function fetchAllUsers(token: string): Promise<ErpUserRow[]> {
  const out: ErpUserRow[] = [];
  for (let i = 0; i < 100; i++) {
    const page = await erpFetch<{ items?: ErpUserRow[]; hasMore?: boolean }>("rx-data/user-create", {
      token,
      query: out.length ? { offset: out.length } : undefined,
    });
    const items = page?.items ?? [];
    out.push(...items);
    if (!page?.hasMore || items.length === 0) break;
  }
  return out;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

async function build(s: Session): Promise<Entry> {
  const users = await fetchAllUsers(s.erpToken);
  const chambers = new Map<number, ErpChamberRow[]>();
  let failed = 0;
  let authError: ErpError | null = null;
  await pool(users.filter(isErpDoctor), CONCURRENCY, async (u) => {
    if (authError) return;
    try {
      const r = await erpFetch<{ items?: ErpChamberRow[] }>("rx-data/rx-doctor-chamber", {
        token: s.erpToken, query: { user_id: u.user_id }, timeoutMs: 20_000,
      });
      chambers.set(u.user_id, r?.items ?? []);
    } catch (e) {
      if (e instanceof ErpError && e.status === 401) authError = e; // the session is over: stop
      else failed++; // one doctor failing must not break the whole list
    }
  });
  if (authError) throw authError;
  if (failed) console.warn(`[doctors] chambers could not be loaded for ${failed} doctor(s)`);
  return { at: Date.now(), users, chambers, failed };
}

function toDoctors(e: Entry): ListedDoctor[] {
  return e.users
    .filter(isErpDoctor)
    .map((u): ListedDoctor => {
      const rows = [...(e.chambers.get(u.user_id) ?? [])].sort((a, b) => a.chamber_id - b.chamber_id);
      const chambers: ListedChamber[] = rows.map((c) => ({
        chamberId: c.chamber_id,
        docCode: (c.doc_code ?? "").trim(),
        chamberName: (c.chamber_name ?? "").trim(),
        chamberAddress: (c.chamber_address ?? "").trim(),
        erpStatus: "synced",
      }));
      return {
        id: `erp-${u.user_id}`,
        erpUserId: u.user_id,
        name: (u.full_name ?? "").trim(),
        email: (u.email ?? "").trim(),
        username: (u.phone_no ?? "").trim(),
        type: "Doctor",
        designation: "", organization: "", specialty: "", bmdc: "",
        npl: chambers.find((c) => c.docCode)?.docCode ?? "",
        chamber: chambers[0]?.chamberName ?? "",
        isActive: (u.is_active ?? "Y").toUpperCase() !== "N",
        createdAt: u.created_at ?? "",
        erpStatus: "synced",
        chambers,
      };
    })
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.erpUserId - a.erpUserId);
}

/** All doctors from the ERP (cached). force = true loads again from the ERP */
export function loadDoctors(s: Session, force = false): Promise<ListedDoctor[]> {
  const key = s.userId;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(toDoctors(hit));
  let p = inflight.get(key);
  if (!p) {
    p = build(s)
      .then((e) => {
        cache.set(key, e);
        return e;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p.then(toDoctors);
}

/** Call after the ERP data changed (new doctor / new chamber) so the next list load is fresh */
export function invalidateDoctors(userId: number) {
  cache.delete(userId);
}

export async function getErpDoctor(s: Session, erpUserId: number): Promise<ListedDoctor | null> {
  return (await loadDoctors(s)).find((d) => d.erpUserId === erpUserId) ?? null;
}

export const normPhone = (v?: string | null) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.startsWith("880") ? "0" + d.slice(3) : d;
};

/** The NPL (doc_code) of one doctor, read live from the ERP (used when the cached list has no NPL for him) */
export async function fetchDocCode(s: Session, erpUserId: number): Promise<string> {
  const r = await erpFetch<{ items?: ErpChamberRow[] }>("rx-data/rx-doctor-chamber", {
    token: s.erpToken, query: { user_id: erpUserId }, timeoutMs: 20_000,
  });
  const rows = [...(r?.items ?? [])].sort((a, b) => a.chamber_id - b.chamber_id);
  return rows.find((c) => (c.doc_code ?? "").trim())?.doc_code?.trim() ?? "";
}

/** After user-create, when the ERP did not send the new user id back: find it by phone number */
export async function findErpUserIdByPhone(s: Session, phone: string): Promise<number | null> {
  const p = normPhone(phone);
  return (await fetchAllUsers(s.erpToken)).find((u) => normPhone(u.phone_no) === p)?.user_id ?? null;
}

/**
 * Before creating a doctor: stop duplicates that already exist in the ERP.
 * Phone is always checked (1 ERP call, or the cache). NPL is checked only when the chambers are already loaded.
 * If the ERP can't be read here, this check is skipped (the ERP itself still decides).
 */
export async function assertDoctorFreeInErp(s: Session, npl: string, phone: string) {
  const hit = cache.get(s.userId);
  let users = hit?.users;
  if (!users) {
    try {
      users = await fetchAllUsers(s.erpToken);
    } catch (e) {
      if (e instanceof ErpError && e.status === 401) throw e;
      console.warn("[doctors] duplicate check skipped, could not read the ERP user list");
      return;
    }
  }
  const p = normPhone(phone);
  if (users.some((u) => normPhone(u.phone_no) === p)) throw new UserDuplicate("This username / phone is already used by a user in the ERP");
  if (hit) {
    const code = padNpl(npl);
    for (const list of hit.chambers.values()) {
      if (list.some((c) => c.doc_code && padNpl(c.doc_code) === code)) throw new UserDuplicate("Another doctor already has this NPL number");
    }
  }
}
