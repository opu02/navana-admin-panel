// TEMPORARY local list storage on this PC (data/<name>.json), for lists the ERP has no API for yet.
import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type LocalRow = {
  data_id: string;
  name_desc: string;
  is_active: string;
  is_sys_data: string;
  created_by: number | null;
  created_at: string;
  last_modified: string;
};

const DIR = path.join(process.cwd(), "data");

export async function readLocalList(name: string, seed: string[]): Promise<LocalRow[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${name}.json`), "utf8")) as LocalRow[];
  } catch {
    const now = new Date().toISOString();
    // seed keeps the original order: first item = newest
    return seed.map((n, i) => ({
      data_id: `seed_${String(i + 1).padStart(3, "0")}`,
      name_desc: n,
      is_active: "Y",
      is_sys_data: "Y",
      created_by: null,
      created_at: new Date(Date.parse(now) - i * 1000).toISOString(),
      last_modified: now,
    }));
  }
}

let queue: Promise<unknown> = Promise.resolve();
export function writeLocalList(name: string, rows: LocalRow[]) {
  const run = queue.then(async () => {
    await fs.mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${name}.json`);
    await fs.writeFile(file + ".tmp", JSON.stringify(rows, null, 2), "utf8");
    await fs.rename(file + ".tmp", file);
  });
  queue = run.catch(() => undefined);
  return run;
}
