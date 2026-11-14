// Duration from the ERP (rx-data/rx-duration). Fields match the app's DurationItem.
import "server-only";
import { assertPostOk, erpFetch, erpFetchAll, erpNow, newErpId, type ErpPostResult } from "./erp";
import type { Session } from "./session";
import { DURATION_TYPES, durationName, type DurationItem, type DurationListResponse } from "./duration-types";
import type { DurationForm } from "./duration-schema";

type Row = {
  data_id: string;
  duration_name?: string | null;
  duration_number?: number | null;
  duration_type?: string | null;
  duration_type_desc?: string | null;
  is_active?: string | null;
  is_sys_data?: string | null;
  last_modified?: string | null;
  uuid?: string | null;
  created_by?: number | null;
  created_at?: string | null;
};
type Entry = { rows: Map<string, Row>; at: number; loading: Promise<void> | null };

const PATH = "rx-data/rx-duration";
const TTL = 60_000;
const g = globalThis as unknown as { __durationCache?: Map<number, Entry> };
const cache = (g.__durationCache ??= new Map());

export class DurationNotFound extends Error {}
export class DurationDuplicate extends Error {}

const toItem = (r: Row): DurationItem => ({
  id: r.data_id,
  name: (r.duration_name ?? "").trim(),
  number: r.duration_number ?? null,
  type: r.duration_type ?? "",
  typeDesc: r.duration_type_desc ?? "",
  isActive: (r.is_active ?? "Y") === "Y",
  isSystem: r.is_sys_data === "Y",
  createdBy: r.created_by ?? null,
  createdAt: r.created_at ?? "",
});

async function load(s: Session, force = false): Promise<Entry> {
  let e = cache.get(s.userId);
  if (!e) {
    e = { rows: new Map(), at: 0, loading: null };
    cache.set(s.userId, e);
  }
  if (e.loading) await e.loading;
  else if (force || !e.at || Date.now() - e.at > TTL) {
    const entry = e;
    entry.loading = erpFetchAll<Row>(PATH, s.erpToken, { user_id: s.userId })
      .then((rows) => {
        entry.rows = new Map(rows.filter((r) => r?.data_id).map((r) => [r.data_id, r]));
        entry.at = Date.now();
      })
      .finally(() => {
        entry.loading = null;
      });
    await entry.loading;
  }
  return e;
}

export async function listDurations(
  s: Session, q: { search: string; inactive: boolean; page: number; pageSize: number; refresh?: boolean }
): Promise<DurationListResponse> {
  const e = await load(s, q.refresh);
  const term = q.search.trim().toLowerCase();
  const rows = [...e.rows.values()]
    .map(toItem)
    .filter((x) => x.isActive !== q.inactive)
    .filter((x) => !term || x.name.toLowerCase().includes(term) || String(x.number ?? "").includes(term) || x.typeDesc.toLowerCase().includes(term))
    // Day → Week → Month, then by number
    .sort((a, b) => "DWM".indexOf(a.type) - "DWM".indexOf(b.type) || (a.number ?? 0) - (b.number ?? 0));
  return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
}

export async function getDuration(s: Session, id: string) {
  const r = (await load(s)).rows.get(id);
  if (!r) throw new DurationNotFound();
  return toItem(r);
}

function build(f: DurationForm) {
  const t = DURATION_TYPES.find((x) => x.code === f.type)!;
  return {
    duration_name: durationName(f.number, f.type),
    duration_number: Number(f.number),
    duration_type: t.code,
    duration_type_desc: t.desc,
  };
}

function checkDuplicate(e: Entry, id: string, f: DurationForm) {
  for (const r of e.rows.values()) {
    if (r.data_id !== id && (r.is_active ?? "Y") === "Y" && Number(r.duration_number) === Number(f.number) && r.duration_type === f.type) {
      throw new DurationDuplicate();
    }
  }
}

async function post(s: Session, e: Entry, row: Row) {
  assertPostOk(await erpFetch<ErpPostResult>(PATH, { method: "POST", token: s.erpToken, body: { items: [row] } }));
  e.rows.set(row.data_id, row);
  return toItem(row);
}

export async function createDuration(s: Session, f: DurationForm) {
  const e = await load(s);
  checkDuplicate(e, "", f);
  const id = newErpId(s.userId);
  const now = erpNow();
  return post(s, e, {
    data_id: id, ...build(f), is_active: "Y", is_sys_data: "Y",
    last_modified: now, uuid: id, created_by: s.userId, created_at: now,
  });
}

export async function updateDuration(s: Session, id: string, f: DurationForm) {
  const e = await load(s);
  const old = e.rows.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new DurationNotFound();
  checkDuplicate(e, id, f);
  return post(s, e, { ...old, ...build(f), last_modified: erpNow() });
}

export async function deactivateDuration(s: Session, id: string) {
  const e = await load(s);
  const old = e.rows.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new DurationNotFound();
  await post(s, e, { ...old, is_active: "N", last_modified: erpNow() });
}
