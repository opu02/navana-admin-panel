// TEMPORARY role & permission storage on this PC (the ERP has no API for this yet):
//   data/roles.json        → the role list (segments + allowed actions)
//   data/permissions.json  → { userId: { roleId: { create: true, ... } } }
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Action, Permissions, Role } from "./role-types";
import type { RoleForm } from "./role-schema";

const DIR = path.join(process.cwd(), "data");
const ROLES = path.join(DIR, "roles.json");
const PERMS = path.join(DIR, "permissions.json");

const CUDV: Action[] = ["create", "update", "delete", "view"];
// Same list as the old panel
const SEED: [string, Action[]][] = [
  ["Prescription Report", ["view", "export"]],
  ["Doctor Report", ["view", "export"]],
  ["Drug", CUDV],
  ["Chief Complains", CUDV],
  ["Onexamination", CUDV],
  ["Diagnosis", CUDV],
  ["Investigation", CUDV],
  ["Procedure", CUDV],
  ["Advice", CUDV],
  ["Handout", CUDV],
  ["Dose", CUDV],
  ["Instruction", CUDV],
  ["Specialty", CUDV],
  ["History", CUDV],
  ["User", CUDV],
  ["User Role", CUDV],
  ["Admin User", CUDV],
  ["Doctor", CUDV],
  ["License", ["create", "view"]],
  ["Brand Form Short", [...CUDV, "export"]],
  ["Duration", [...CUDV, "export"]],
  ["Generic", CUDV],
];

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readJson<T>(file: string, fallback: () => T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback();
  }
}
async function writeJson(file: string, data: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file + ".tmp", JSON.stringify(data, null, 2), "utf8");
  await fs.rename(file + ".tmp", file);
}

const seedRoles = (): Role[] => SEED.map(([name, actions], i) => ({ id: `r${i + 1}`, name, actions }));

export class RoleDuplicate extends Error {}
export class RoleNotFound extends Error {}

export const listRoles = () => readJson<Role[]>(ROLES, seedRoles);

export function createRole(f: RoleForm) {
  return locked(async () => {
    const all = await listRoles();
    if (all.some((r) => r.name.toLowerCase() === f.name.trim().toLowerCase())) throw new RoleDuplicate();
    const role: Role = { id: crypto.randomUUID(), name: f.name.trim(), actions: [...new Set(f.actions)] };
    await writeJson(ROLES, [...all, role]);
    return role;
  });
}

export function updateRole(id: string, f: RoleForm) {
  return locked(async () => {
    const all = await listRoles();
    const i = all.findIndex((r) => r.id === id);
    if (i < 0) throw new RoleNotFound();
    if (all.some((r) => r.id !== id && r.name.toLowerCase() === f.name.trim().toLowerCase())) throw new RoleDuplicate();
    all[i] = { id, name: f.name.trim(), actions: [...new Set(f.actions)] };
    await writeJson(ROLES, all);
    return all[i];
  });
}

export function deleteRole(id: string) {
  return locked(async () => {
    const all = await listRoles();
    if (!all.some((r) => r.id === id)) throw new RoleNotFound();
    await writeJson(ROLES, all.filter((r) => r.id !== id));
    // remove it from every user's permissions
    const perms = await readJson<Record<string, Permissions>>(PERMS, () => ({}));
    for (const u of Object.values(perms)) delete u[id];
    await writeJson(PERMS, perms);
  });
}

export async function getPermissions(userId: string): Promise<Permissions> {
  const perms = await readJson<Record<string, Permissions>>(PERMS, () => ({}));
  return perms[userId] ?? {};
}

/** Saves only actions that the role really supports */
export function setPermissions(userId: string, input: Record<string, Record<string, boolean>>) {
  return locked(async () => {
    const roles = await listRoles();
    const clean: Permissions = {};
    for (const r of roles) {
      const p = (input[r.id] ?? {}) as Partial<Record<Action, boolean>>;
      clean[r.id] = Object.fromEntries(r.actions.map((a) => [a, p[a] === true]));
    }
    const perms = await readJson<Record<string, Permissions>>(PERMS, () => ({}));
    perms[userId] = clean;
    await writeJson(PERMS, perms);
    return clean;
  });
}
