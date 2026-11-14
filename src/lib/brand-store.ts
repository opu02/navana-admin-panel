// Drug Brand data from the ERP, cached on our server.
// - First load: all brands (paged, 500 at a time). This can take some time (34k+ rows).
// - After that: only changed brands, using last_modified (same idea as the app's sync).
// Search, filter and paging run here, so the browser only gets one page.
import "server-only";
import {
  assertPostOk, erpFetch, erpFetchAll, erpNow, newErpId,
  type ErpBrand, type ErpNamedItem, type ErpPostResult,
} from "./erp";
import type { Session } from "./session";
import type { Brand, BrandListResponse, BrandOptions, BrandView, Option } from "./brand-types";
import type { BrandForm } from "./brand-schema";
import { masterOptions } from "./master-store";

// ERP field name for the NPS Code. Change here if the ERP team uses a different name.
const NPS_FIELD = "nps_code";

const FULL_RELOAD_MS = 6 * 3600_000; // full reload every 6 hours
const DELTA_MS = 60_000; // check for changes at most once a minute
const LOOKUP_MS = 10 * 60_000; // generics / companies: 10 minutes

type Entry = {
  brands: Map<string, ErpBrand>;
  fullAt: number;
  deltaAt: number;
  maxModified: string;
  loading: Promise<void> | null;
};
type Lookup = { at: number; items: Option[] };

const g = globalThis as unknown as {
  __brandCache?: Map<number, Entry>;
  __lookupCache?: Map<string, Lookup>;
};
const cache = (g.__brandCache ??= new Map());
const lookups = (g.__lookupCache ??= new Map());

export class BrandNotFound extends Error {}
export class BrandDuplicate extends Error {}
export class BadReference extends Error {}

// ---------------- mapping ----------------
function toBrand(b: ErpBrand): Brand {
  return {
    id: b.data_id,
    brandId: b.brand_id ?? b.data_id,
    name: b.brand_name ?? "",
    formId: b.form_id ?? "",
    form: b.form_desc ?? "",
    strengthId: b.strength_id ?? "",
    strength: b.strength_desc ?? "",
    genericId: b.generic_id ?? "",
    generic: b.generic_name ?? "",
    companyId: b.company_id ?? "",
    company: b.company_name ?? "",
    npsCode: String((b as Record<string, unknown>)[NPS_FIELD] ?? ""),
    isActive: (b.is_active ?? "Y") === "Y",
    isSystem: b.is_sys_data === "Y",
    createdBy: b.created_by ?? null,
    createdAt: b.created_at ?? "",
    lastModified: b.last_modified ?? "",
  };
}

const maxOf = (a: string, b?: string | null) => (b && b > a ? b : a);

// ---------------- loading ----------------
async function fullLoad(s: Session, e: Entry) {
  const rows = await erpFetchAll<ErpBrand>("rx-data/rx-brand", s.erpToken, { user_id: s.userId });
  const map = new Map<string, ErpBrand>();
  let max = "";
  for (const r of rows) {
    if (!r?.data_id) continue;
    map.set(r.data_id, r);
    max = maxOf(max, r.last_modified);
  }
  e.brands = map;
  e.maxModified = max;
  e.fullAt = e.deltaAt = Date.now();
}

async function deltaLoad(s: Session, e: Entry) {
  const rows = await erpFetchAll<ErpBrand>("rx-data/rx-brand", s.erpToken, {
    user_id: s.userId,
    last_modified: e.maxModified || undefined,
  });
  for (const r of rows) {
    if (!r?.data_id) continue;
    e.brands.set(r.data_id, r);
    e.maxModified = maxOf(e.maxModified, r.last_modified);
  }
  e.deltaAt = Date.now();
}

async function ensureLoaded(s: Session, force = false): Promise<Entry> {
  let e = cache.get(s.userId);
  if (!e) {
    e = { brands: new Map(), fullAt: 0, deltaAt: 0, maxModified: "", loading: null };
    cache.set(s.userId, e);
  }
  if (e.loading) {
    await e.loading;
    return e;
  }
  const now = Date.now();
  const needFull = force || !e.fullAt || now - e.fullAt > FULL_RELOAD_MS;
  const needDelta = !needFull && now - e.deltaAt > DELTA_MS;
  if (needFull || needDelta) {
    const entry = e;
    entry.loading = (needFull ? fullLoad(s, entry) : deltaLoad(s, entry)).finally(() => {
      entry.loading = null;
    });
    await entry.loading;
  }
  return e;
}

async function namedList(s: Session, path: string): Promise<Option[]> {
  const key = `${s.userId}:${path}`;
  const hit = lookups.get(key);
  if (hit && Date.now() - hit.at < LOOKUP_MS) return hit.items;
  const rows = await erpFetchAll<ErpNamedItem>(path, s.erpToken, { user_id: s.userId });
  const items = rows
    .filter((r) => r?.data_id && r.name_desc && (r.is_active ?? "Y") === "Y")
    .map((r) => ({ id: r.data_id, name: r.name_desc!.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  lookups.set(key, { at: Date.now(), items });
  return items;
}

// ---------------- public API ----------------
export async function listBrands(
  s: Session,
  q: { search: string; view: BrandView; companyId: string; page: number; pageSize: number; refresh?: boolean }
): Promise<BrandListResponse> {
  const e = await ensureLoaded(s, q.refresh);
  const term = q.search.trim().toLowerCase();

  const rows: Brand[] = [];
  for (const raw of e.brands.values()) {
    const b = toBrand(raw);
    if (q.view === "inactive" ? b.isActive : !b.isActive) continue;
    if (q.view === "system" && !b.isSystem) continue;
    if (q.view === "doctor" && b.isSystem) continue;
    if (q.companyId && b.companyId !== q.companyId) continue;
    if (
      term &&
      !b.name.toLowerCase().includes(term) &&
      !b.generic.toLowerCase().includes(term) &&
      !b.company.toLowerCase().includes(term) &&
      !b.form.toLowerCase().includes(term) &&
      !b.strength.toLowerCase().includes(term) &&
      !b.npsCode.toLowerCase().includes(term)
    ) continue;
    rows.push(b);
  }
  // newest first
  rows.sort((a, b) => (b.createdAt || b.lastModified).localeCompare(a.createdAt || a.lastModified));

  return {
    items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: rows.length,
    page: q.page,
    pageSize: q.pageSize,
    loadedAt: new Date(e.deltaAt || Date.now()).toISOString(),
  };
}

export async function getBrand(s: Session, id: string): Promise<Brand> {
  const e = await ensureLoaded(s);
  const raw = e.brands.get(id);
  if (!raw) throw new BrandNotFound();
  return toBrand(raw);
}

export async function getBrandOptions(s: Session): Promise<BrandOptions> {
  const [e, generics, companies, formMaster] = await Promise.all([
    ensureLoaded(s),
    namedList(s, "rx-data/rx-generic"),
    namedList(s, "rx-data/rx-company"),
    masterOptions(s, "form").catch(() => []),
  ]);
  // Forms: the ERP form list (Brand Form Short) + forms used in existing brands. Strengths: from brands.
  const forms = new Map<string, string>(formMaster.map((f) => [f.id, f.name]));
  const strengths = new Map<string, string>();
  for (const b of e.brands.values()) {
    if (b.form_id && b.form_desc?.trim()) forms.set(b.form_id, b.form_desc.trim());
    if (b.strength_id && b.strength_desc?.trim()) strengths.set(b.strength_id, b.strength_desc.trim());
  }
  const toList = (m: Map<string, string>) =>
    [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { generics, companies, forms: toList(forms), strengths: toList(strengths) };
}

/** Check ids against the ERP lists and build the ERP row */
async function resolve(s: Session, f: BrandForm, base: Partial<ErpBrand>): Promise<ErpBrand> {
  const opts = await getBrandOptions(s);
  const generic = opts.generics.find((x) => x.id === f.genericId);
  const company = opts.companies.find((x) => x.id === f.companyId);
  if (!generic) throw new BadReference("Please select a valid generic");
  if (!company) throw new BadReference("Please select a valid company");

  // Form/strength: an existing id, or "" + new text (the ERP creates it, like in the app)
  const form = f.formId ? opts.forms.find((x) => x.id === f.formId) : undefined;
  if (f.formId && !form) throw new BadReference("Please select a valid form");
  const strength = f.strengthId ? opts.strengths.find((x) => x.id === f.strengthId) : undefined;
  if (f.strengthId && !strength) throw new BadReference("Please select a valid strength");

  return {
    ...(base as ErpBrand),
    brand_name: f.name.trim(),
    form_id: form?.id ?? "",
    form_desc: form?.name ?? f.form.trim(),
    strength_id: strength?.id ?? "",
    strength_desc: strength?.name ?? f.strength.trim(),
    generic_id: generic.id,
    generic_name: generic.name,
    company_id: company.id,
    company_name: company.name,
    [NPS_FIELD]: f.npsCode.trim(),
    last_modified: erpNow(),
  } as ErpBrand;
}

function checkDuplicate(e: Entry, row: ErpBrand) {
  const k = (b: ErpBrand) =>
    [b.brand_name, b.form_desc, b.strength_desc, b.company_id].map((x) => (x ?? "").trim().toLowerCase()).join("|");
  const key = k(row);
  for (const b of e.brands.values()) {
    if (b.data_id !== row.data_id && (b.is_active ?? "Y") === "Y" && k(b) === key) throw new BrandDuplicate();
  }
}

async function postBrand(s: Session, e: Entry, row: ErpBrand) {
  const res = await erpFetch<ErpPostResult>("rx-data/rx-brand", {
    method: "POST",
    token: s.erpToken,
    body: { items: [row] },
  });
  const r = assertPostOk(res);
  // the ERP may create ids for a new form/strength
  const saved: ErpBrand = {
    ...row,
    brand_id: r.brand_id || row.brand_id,
    form_id: r.form_id || row.form_id,
    strength_id: r.strength_id || row.strength_id,
  };
  e.brands.set(saved.data_id, saved);
  e.maxModified = maxOf(e.maxModified, saved.last_modified);
  return toBrand(saved);
}

export async function createBrand(s: Session, f: BrandForm) {
  const e = await ensureLoaded(s);
  const id = newErpId(s.userId);
  const now = erpNow();
  const row = await resolve(s, f, {
    data_id: id,
    brand_id: id,
    uuid: id,
    is_active: "Y",
    is_sys_data: "Y", // added by admin = system data
    created_by: s.userId,
    created_at: now,
  });
  checkDuplicate(e, row);
  return postBrand(s, e, row);
}

export async function updateBrand(s: Session, id: string, f: BrandForm) {
  const e = await ensureLoaded(s);
  const old = e.brands.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new BrandNotFound();
  const row = await resolve(s, f, old); // keeps created_by, created_at, is_sys_data, uuid
  checkDuplicate(e, row);
  return postBrand(s, e, row);
}

/** Delete = set is_active to "N" (the ERP has no DELETE for brands) */
export async function deactivateBrand(s: Session, id: string) {
  const e = await ensureLoaded(s);
  const old = e.brands.get(id);
  if (!old || (old.is_active ?? "Y") !== "Y") throw new BrandNotFound();
  await postBrand(s, e, { ...old, is_active: "N", last_modified: erpNow() });
}
