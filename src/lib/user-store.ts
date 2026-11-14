// TEMPORARY user storage on this PC: data/users.json
// Used until the ERP gives a "create user" API. These users are NOT in the ERP yet,
// so they can NOT log in to the app or the admin panel.
// Passwords are never saved as plain text — only a bcrypt hash.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { UserForm } from "./user-schema";

export type StoredUser = Omit<UserForm, "password"> & {
  id: string;
  passwordHash: string;
  isActive?: boolean; // missing = active (older records)
  erpStatus: "pending"; // not sent to the ERP yet
  createdBy: number;
  createdAt: string;
  updatedAt?: string;
};
export type PublicUser = Omit<StoredUser, "passwordHash"> & { isActive: boolean };

const FILE = path.join(process.cwd(), "data", "users.json");
let queue: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<StoredUser[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as StoredUser[];
  } catch {
    return [];
  }
}

async function save(list: StoredUser[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

const toPublic = ({ passwordHash: _h, ...u }: StoredUser): PublicUser => ({ ...u, isActive: u.isActive !== false });

export class UserDuplicate extends Error {}
export class UserNotFound extends Error {}

function checkDuplicate(all: StoredUser[], id: string, email: string, username: string) {
  if (all.some((u) => u.id !== id && u.email.toLowerCase() === email)) throw new UserDuplicate("A user with this email already exists");
  if (all.some((u) => u.id !== id && u.username.toLowerCase() === username)) throw new UserDuplicate("This username / phone is already used");
}

export function createLocalUser(f: UserForm, createdBy: number): Promise<PublicUser> {
  return locked(async () => {
    const all = await load();
    const email = f.email.trim().toLowerCase();
    checkDuplicate(all, "", email, f.username.trim().toLowerCase());
    const { password, ...rest } = f;
    const user: StoredUser = {
      ...rest,
      email,
      id: crypto.randomUUID(),
      passwordHash: await bcrypt.hash(password, 12),
      isActive: true,
      erpStatus: "pending",
      createdBy,
      createdAt: new Date().toISOString(),
    };
    await save([user, ...all]);
    return toPublic(user);
  });
}

export async function listLocalUsers(): Promise<PublicUser[]> {
  return (await load()).map(toPublic);
}

export async function getLocalUser(id: string): Promise<PublicUser> {
  const u = (await load()).find((x) => x.id === id);
  if (!u) throw new UserNotFound();
  return toPublic(u);
}

/** Edit. Empty password = keep the old password. */
export function updateLocalUser(id: string, f: Omit<UserForm, "password"> & { password: string }) {
  return locked(async () => {
    const all = await load();
    const i = all.findIndex((u) => u.id === id);
    if (i < 0) throw new UserNotFound();
    const email = f.email.trim().toLowerCase();
    checkDuplicate(all, id, email, f.username.trim().toLowerCase());
    const { password, ...rest } = f;
    all[i] = {
      ...all[i],
      ...rest,
      email,
      passwordHash: password ? await bcrypt.hash(password, 12) : all[i].passwordHash,
      updatedAt: new Date().toISOString(),
    };
    await save(all);
    return toPublic(all[i]);
  });
}

export function setLocalUserActive(id: string, isActive: boolean) {
  return locked(async () => {
    const all = await load();
    const u = all.find((x) => x.id === id);
    if (!u) throw new UserNotFound();
    u.isActive = isActive;
    u.updatedAt = new Date().toISOString();
    await save(all);
    return toPublic(u);
  });
}

export function deleteLocalUser(id: string) {
  return locked(async () => {
    const all = await load();
    if (!all.some((u) => u.id === id)) throw new UserNotFound();
    await save(all.filter((u) => u.id !== id));
  });
}
