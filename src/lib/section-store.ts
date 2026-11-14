// Rx section data (CC, OE, Diagnosis, Investigation, Procedure, Advice, Handout, History...)
// ERP: GET rx-data/rx-section-data → sections → groups → items
//      POST rx-data/rx-section-data { items: [ item ] }  (same as the app)
// System items live in group "0" ("All").
import "server-only";
import { erpFetch, erpNow, newErpId, ErpError } from "./erp";
import type { Session } from "./session";

export type SectionItem = {
  data_id: string;
  data_value?: string | null;
  data_details?: string | null;
  group_id?: string | null;
  is_active?: string | null;
  is_sys_data?: string | null;
  is_favorite?: string | null;
  created_by?: string | number | null;
  created_at?: string | null;
  last_modified?: string | null;
  uuid?: string | null;
};
type Group = { group_id?: string; group_name?: string; items?: SectionItem[] };
type Section = { section_id?: number | string; section_name?: string; items?: Group[] };
type SectionResponse = { items?: Section[]; has_more?: string | boolean; page_offset?: number; page_size?: number };

export type SectionRow = SectionItem & { section_id: number; group_name: string };

type Entry = { rows: Map<string, SectionRow>; at: number; loading: Promise<void> | null };
const TTL = 60_000;
const g = globalThis as unknown as { __sectionCache?: Map<number, Entry> };
const cache = (g.__sectionCache ??= new Map());

export const SYSTEM_GROUP = "0";

async function loadAll(s: Session): Promise<Map<string, SectionRow>> {
  const rows = new Map<string, SectionRow>();
  let offset = 0;
  for (let i = 0; i < 50; i++) {
    const res = await erpFetch<SectionResponse>("rx-data/rx-section-data", {
      token: s.erpToken,
      query: { user_id: s.userId, page_offset: offset || undefined },
    });
    const sections = res?.items ?? [];
    for (const sec of sections) {
      const sid = Number(sec.section_id);
      for (const grp of sec.items ?? []) {
        for (const it of grp.items ?? []) {
          if (!it?.data_id) continue;
          rows.set(it.data_id, {
            ...it,
            group_id: it.group_id ?? grp.group_id ?? SYSTEM_GROUP,
            section_id: sid,
            group_name: grp.group_name ?? "",
          });
        }
      }
    }
    const more = String(res?.has_more ?? "false").toLowerCase() === "true";
    if (!more || sections.length === 0) break;
    offset += sections.length;
  }
  return rows;
}

export async function sectionRows(s: Session, sectionId: number, force = false): Promise<SectionRow[]> {
  let e = cache.get(s.userId);
  if (!e) {
    e = { rows: new Map(), at: 0, loading: null };
    cache.set(s.userId, e);
  }
  if (e.loading) await e.loading;
  else if (force || !e.at || Date.now() - e.at > TTL) {
    const entry = e;
    entry.loading = loadAll(s)
      .then((rows) => {
        entry.rows = rows;
        entry.at = Date.now();
      })
      .finally(() => {
        entry.loading = null;
      });
    await entry.loading;
  }
  return [...e.rows.values()].filter((r) => r.section_id === sectionId);
}

async function post(s: Session, row: SectionRow) {
  const { group_name: _gn, ...item } = row;
  const res = await erpFetch<{ items?: { data_id?: string; is_success?: string | boolean; message?: string }[] }>(
    "rx-data/rx-section-data",
    { method: "POST", token: s.erpToken, body: { items: [item] } }
  );
  const first = res?.items?.[0];
  if (!first || String(first.is_success).toLowerCase() !== "true") {
    throw new ErpError(502, first?.message || "The ERP did not accept the change.");
  }
  cache.get(s.userId)?.rows.set(row.data_id, row);
  return row;
}

export function createSectionItem(s: Session, sectionId: number, value: string, details: string) {
  const id = newErpId(s.userId);
  const now = erpNow();
  return post(s, {
    data_id: id,
    section_id: sectionId,
    data_value: value,
    data_details: details,
    group_id: SYSTEM_GROUP,
    group_name: "All",
    is_active: "Y",
    is_sys_data: "Y",
    is_favorite: "0",
    created_by: s.userId,
    created_at: now,
    last_modified: now,
    uuid: id,
  });
}

export function saveSectionItem(s: Session, row: SectionRow) {
  return post(s, { ...row, last_modified: erpNow() });
}
