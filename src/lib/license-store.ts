// TEMPORARY license storage on this PC (data/licenses.json) — the ERP has no license API yet.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { License, LicenseData } from "./license-schema";

const FILE = path.join(process.cwd(), "data", "licenses.json");
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function listLicenses(): Promise<License[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as License[];
  } catch {
    return [];
  }
}

async function save(list: License[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE + ".tmp", JSON.stringify(list, null, 2), "utf8");
  await fs.rename(FILE + ".tmp", FILE);
}

/** Same key format as the old system: a random UUID (crypto-secure) */
const newKey = () => crypto.randomUUID();

export function createLicenses(d: LicenseData, createdBy: number): Promise<License[]> {
  return locked(async () => {
    const all = await listLicenses();
    const used = new Set(all.map((l) => l.key));
    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: License[] = [];
    while (created.length < d.quantity) {
      const key = newKey();
      if (used.has(key)) continue;
      used.add(key);
      created.push({
        id: crypto.randomUUID(), key, duration: d.duration, unit: d.unit, backupPermission: d.backupPermission,
        status: "unused", usedBy: null, regDate: null, validTill: null, createdBy, createdAt: now, batchId,
      });
    }
    await save([...created, ...all]);
    return created;
  });
}
