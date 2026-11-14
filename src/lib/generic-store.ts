// TEMPORARY storage for Generics: a JSON file on this PC.
// - data/generics.seed.json = the original list (2,328 names, never changed)
// - data/generics.json      = your working copy (created on first use; add/edit/delete go here)
// Step 10: replace this file with calls to the ASP.NET Core API + database.
import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type Generic = { id: number; name: string };

const DIR = path.join(process.cwd(), "data");
const SEED = path.join(DIR, "generics.seed.json");
const FILE = path.join(DIR, "generics.json");

let cache: Generic[] | null = null;
let queue: Promise<unknown> = Promise.resolve(); // one write at a time

async function load(): Promise<Generic[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as Generic[];
  } catch {
    cache = JSON.parse(await fs.readFile(SEED, "utf8")) as Generic[];
    await fs.writeFile(FILE, JSON.stringify(cache), "utf8");
  }
  return cache;
}

async function save(list: Generic[]) {
  cache = list;
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list), "utf8");
  await fs.rename(tmp, FILE);
}

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const key = (s: string) => norm(s).toLowerCase();

export class DuplicateError extends Error {}
export class NotFoundError extends Error {}

export async function listGenerics(search: string, page: number, pageSize: number) {
  const all = await load();
  const q = key(search);
  const rows = q ? all.filter((g) => g.name.toLowerCase().includes(q)) : all;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export async function getGeneric(id: number) {
  const g = (await load()).find((x) => x.id === id);
  if (!g) throw new NotFoundError();
  return g;
}

export function createGeneric(name: string) {
  return locked(async () => {
    const all = await load();
    const n = norm(name);
    if (all.some((g) => key(g.name) === key(n))) throw new DuplicateError();
    const g = { id: all.reduce((m, x) => Math.max(m, x.id), 0) + 1, name: n };
    await save([g, ...all]); // newest first, like the old panel
    return g;
  });
}

export function updateGeneric(id: number, name: string) {
  return locked(async () => {
    const all = await load();
    const i = all.findIndex((g) => g.id === id);
    if (i < 0) throw new NotFoundError();
    const n = norm(name);
    if (all.some((g) => g.id !== id && key(g.name) === key(n))) throw new DuplicateError();
    const next = [...all];
    next[i] = { id, name: n };
    await save(next);
    return next[i];
  });
}

export function deleteGeneric(id: number) {
  return locked(async () => {
    const all = await load();
    if (!all.some((g) => g.id === id)) throw new NotFoundError();
    await save(all.filter((g) => g.id !== id));
  });
}
