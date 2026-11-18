// Doctor chambers, saved on this PC: data/chambers.json
// Same fields as the app's doctor_chamber_table (chamber_id, user_id, doc_code, chamber_name, chamber_address),
// so they can be sent to the ERP as they are when the ERP gives a "save chamber" API.
import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type Chamber = {
  chamberId: number;
  userId: string; // website user id
  docCode: string; // doctor's NPL number (10 digits)
  chamberName: string;
  chamberAddress: string;
  erpStatus: "pending" | "synced"; // "synced" = saved in the ERP too
  erpChamberId?: number;
  createdAt: string;
  createdBy: number;
  updatedAt?: string;
  updatedBy?: number;
};

const FILE = path.join(process.cwd(), "data", "chambers.json");
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}
async function load(): Promise<Chamber[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Chamber[];
  } catch (e) {
    // only "file not found" = empty; anything else must not be turned into an empty list (it would be overwritten)
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw e;
  }
}
async function save(list: Chamber[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export class ChamberNotFound extends Error {}
export class ChamberDuplicate extends Error {}

const byId = (a: Chamber, b: Chamber) => a.chamberId - b.chamberId;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function listChambers(userId: string): Promise<Chamber[]> {
  return (await load()).filter((c) => c.userId === userId).sort(byId);
}

/** userId → chambers, for the doctor list */
export async function chambersByUser(): Promise<Map<string, Chamber[]>> {
  const map = new Map<string, Chamber[]>();
  for (const c of (await load()).sort(byId)) map.set(c.userId, [...(map.get(c.userId) ?? []), c]);
  return map;
}

export function addChamber(
  userId: string, docCode: string, name: string, address: string, by: number,
  erp?: { erpChamberId: number | null } // pass this when the chamber was saved in the ERP
) {
  return locked(async () => {
    const all = await load();
    if (all.some((c) => c.userId === userId && same(c.chamberName, name))) throw new ChamberDuplicate("This doctor already has a chamber with this name");
    const chamber: Chamber = {
      chamberId: Math.max(1000, ...all.map((c) => c.chamberId)) + 1,
      userId, docCode, chamberName: name.trim(), chamberAddress: address.trim(),
      erpStatus: erp ? "synced" : "pending", createdAt: new Date().toISOString(), createdBy: by,
      ...(erp?.erpChamberId ? { erpChamberId: erp.erpChamberId } : {}),
    };
    await save([...all, chamber]);
    return chamber;
  });
}

export function updateChamber(userId: string, chamberId: number, name: string, address: string, by: number) {
  return locked(async () => {
    const all = await load();
    const c = all.find((x) => x.userId === userId && x.chamberId === chamberId);
    if (!c) throw new ChamberNotFound();
    if (all.some((x) => x !== c && x.userId === userId && same(x.chamberName, name))) throw new ChamberDuplicate("This doctor already has a chamber with this name");
    Object.assign(c, { chamberName: name.trim(), chamberAddress: address.trim(), updatedAt: new Date().toISOString(), updatedBy: by });
    await save(all);
    return c;
  });
}

export function deleteChamber(userId: string, chamberId: number) {
  return locked(async () => {
    const all = await load();
    if (!all.some((c) => c.userId === userId && c.chamberId === chamberId)) throw new ChamberNotFound();
    await save(all.filter((c) => !(c.userId === userId && c.chamberId === chamberId)));
  });
}

/** Keep doc_code in step when the doctor's NPL changes */
export function setChamberDocCode(userId: string, docCode: string) {
  return locked(async () => {
    const all = await load();
    let changed = false;
    for (const c of all) if (c.userId === userId && c.docCode !== docCode) { c.docCode = docCode; changed = true; }
    if (changed) await save(all);
  });
}

export function deleteChambersOfUser(userId: string) {
  return locked(async () => {
    const all = await load();
    const rest = all.filter((c) => c.userId !== userId);
    if (rest.length !== all.length) await save(rest);
  });
}
