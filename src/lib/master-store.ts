// Reusable ERP store for simple name lists (Form, and later Dose, Duration, ...)
import "server-only";
import { assertPostOk, erpFetch, erpFetchAll, erpNow, newErpId, type ErpNamedItem, type ErpPostResult } from "./erp";
import type { Session } from "./session";
import { MASTER, type MasterItem, type MasterKey, type MasterListResponse } from "./master-config";
import type { MasterForm } from "./master-schema";
import { readLocalList, writeLocalList, type LocalRow } from "./local-list";
import { createSectionItem, saveSectionItem, sectionRows, type SectionRow } from "./section-store";

type Row = ErpNamedItem & Record<string, unknown>;
type Entry = { rows: Map<string, Row>; at: number; loading: Promise<void> | null };

const TTL = 60_000; // reload from the ERP at most once a minute
const g = globalThis as unknown as { __masterCache?: Map<string, Entry> };
const cache = (g.__masterCache ??= new Map());

export class MasterNotFound extends Error {}
export class MasterDuplicate extends Error {}

function toItem(key: MasterKey, r: Row): MasterItem {
  const extraField = MASTER[key].extra?.erpField;
  return {
    group: String(r.group_name ?? ""),
    id: r.data_id,
    name: (r.name_desc ?? "").trim(),
    extra: extraField ? String(r[extraField] ?? "") : "",
    isActive: (r.is_active ?? "Y") === "Y",
    isSystem: r.is_sys_data === "Y",
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? "",
  };
}

const fromSection = (r: SectionRow): Row => ({
  ...r,
  name_desc: r.data_value ?? "",
  created_by: r.created_by == null ? null : Number(r.created_by),
} as unknown as Row);

async function load(s: Session, key: MasterKey, force = false): Promise<Entry> {
  const local = MASTER[key].local;
  if (local) {
    const rows = await readLocalList(local.file, local.seed);
    return { rows: new Map(rows.map((r) => [r.data_id, r as unknown as Row])), at: Date.now(), loading: null };
  }
  const sid = MASTER[key].sectionId;
  if (sid !== undefined) {
    const rows = await sectionRows(s, sid, force);
    return { rows: new Map(rows.map((r) => [r.data_id, fromSection(r)])), at: Date.now(), loading: null };
  }
  const ck = `${s.userId}:${key}`;
  let e = cache.get(ck);
  if (!e) {
    e = { rows: new Map(), at: 0, loading: null };
    cache.set(ck, e);
  }
  if (e.loading) {
    await e.loading;
    return e;
  }
  if (force || !e.at || Date.now() - e.at > TTL) {
    const entry = e;
    entry.loading = erpFetchAll<Row>(MASTER[key].path, s.erpToken, { user_id: s.userId })
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

export async function listMaster(
  s: Session, key: MasterKey,
  q: { search: string; inactive: boolean; page: number; pageSize: number; refresh?: boolean }
): Promise<MasterListResponse> {
  const e = await load(s, key, q.refresh);
  const term = q.search.trim().toLowerCase();
  const rows = [...e.rows.values()]
    .map((r) => toItem(key, r))
    .filter((x) => x.isActive !== q.inactive)
    .filter((x) => !term || x.name.toLowerCase().includes(term) || x.extra.toLowerCase().includes(term))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
  return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
}

/** Active items as { id, name } for dropdowns */
export async function masterOptions(s: Session, key: MasterKey) {
  const e = await load(s, key);
  return [...e.rows.values()]
    .filter((r) => (r.is_active ?? "Y") === "Y" && r.name_desc?.trim())
    .map((r) => ({ id: r.data_id, name: r.name_desc!.trim() }));
}

export async function getMaster(s: Session, key: MasterKey, id: string) {
  const e = await load(s, key);
  const r = e.rows.get(id);
  if (!r) throw new MasterNotFound();
  return toItem(key, r);
}

function checkDuplicate(e: Entry, id: string, name: string) {
  const n = name.trim().toLowerCase();
  for (const r of e.rows.values()) {
    if (r.data_id !== id && (r.is_active ?? "Y") === "Y" && (r.name_desc ?? "").trim().toLowerCase() === n) {
      throw new MasterDuplicate();
    }
  }
}

async function post(s: Session, key: MasterKey, e: Entry, row: Row) {
  const local = MASTER[key].local;
  if (local) {
    e.rows.set(row.data_id, row);
    await writeLocalList(local.file, [...e.rows.values()] as unknown as LocalRow[]);
    return toItem(key, row);
  }
  const res = await erpFetch<ErpPostResult>(MASTER[key].path, { method: "POST", token: s.erpToken, body: { items: [row] } });
  assertPostOk(res);
  e.rows.set(row.data_id, row);
  return toItem(key, row);
}

function withExtra(key: MasterKey, row: Row, f: MasterForm): Row {
  const field = MASTER[key].extra?.erpField;
  return field ? { ...row, [field]: f.extra.trim() } : row;
}

const clean = (v: string) => v.trim().replace(/\s+/g, " ");

export async function createMaster(s: Session, key: MasterKey, f: MasterForm) {
  const e = await load(s, key);
  checkDuplicate(e, "", f.name);
  const sid = MASTER[key].sectionId;
  if (sid !== undefined) {
    return toItem(key, fromSection(await createSectionItem(s, sid, clean(f.name), f.extra.trim())));
  }
  const id = newErpId(s.userId);
  const now = erpNow();
  const row: Row = withExtra(key, {
    data_id: id, name_desc: f.name.trim().replace(/\s+/g, " "), is_active: "Y", is_sys_data: "Y",
    last_modified: now, uuid: id, created_by: s.userId, created_at: now,
  }, f);
  return post(s, key, e, row);
}

export async function updateMaster(s: Session, key: MasterKey, id: string, f: MasterForm) {
  const e = await load(s, key);
  const old = e.rows.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new MasterNotFound();
  checkDuplicate(e, id, f.name);
  if (MASTER[key].sectionId !== undefined) {
    const { name_desc: _n, ...rest } = old;
    const row = { ...(rest as unknown as SectionRow), data_value: clean(f.name), ...(MASTER[key].extra ? { data_details: f.extra.trim() } : {}) };
    return toItem(key, fromSection(await saveSectionItem(s, row)));
  }
  const row = withExtra(key, { ...old, name_desc: f.name.trim().replace(/\s+/g, " "), last_modified: erpNow() }, f);
  return post(s, key, e, row);
}

/** Delete = is_active "N" */
export async function deactivateMaster(s: Session, key: MasterKey, id: string) {
  const e = await load(s, key);
  const old = e.rows.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new MasterNotFound();
  if (MASTER[key].sectionId !== undefined) {
    const { name_desc: _n, ...rest } = old;
    await saveSectionItem(s, { ...(rest as unknown as SectionRow), is_active: "N" });
    return;
  }
  await post(s, key, e, { ...old, is_active: "N", last_modified: erpNow() });
}
