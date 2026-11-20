// TEMPORARY user storage on this PC: data/users.json
// Used until the ERP gives a "create user" API. These users are NOT in the ERP yet,
// so they can NOT log in to the app or the admin panel.
// Passwords are never saved as plain text:
//  - passwordHash: bcrypt, to check logins on this website
//  - passwordEnc:  AES-256-GCM (key in .env.local), so the real password can be sent to the ERP later
//    (the ERP needs it as plain text). Never sent to the browser.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { padNpl, type DoctorCreateForm, type UserForm } from "./user-schema";
import { deleteChambersOfUser, setChamberDocCode } from "./chamber-store";
import { assertSecretKey, decryptSecret, encryptSecret } from "./secret-box";

export type StoredUser = Omit<UserForm, "password"> & {
  id: string;
  passwordHash: string;
  passwordEnc?: string; // encrypted real password, for the ERP migration (missing on older records)
  isActive?: boolean; // missing = active (older records)
  erpStatus: "pending" | "synced"; // "synced" = created in the ERP (doctors from the Create User page)
  erpUserId?: number; // the ERP's user id (doc_user_id), used to add chambers
  createdBy: number;
  createdAt: string;
  updatedAt?: string;
};
export type PublicUser = Omit<StoredUser, "passwordHash" | "passwordEnc"> & { isActive: boolean };

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
  } catch (e) {
    // Only "file not found" means "no users yet". Any other error (broken JSON, no permission)
    // must stop here, otherwise the next save would overwrite the real data with an empty list.
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw e;
  }
}

async function save(list: StoredUser[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

const toPublic = ({ passwordHash: _h, passwordEnc: _e, ...u }: StoredUser): PublicUser => ({ ...u, npl: padNpl(u.npl), isActive: u.isActive !== false });

export class UserDuplicate extends Error {}
export class UserNotFound extends Error {}

function checkDuplicate(all: StoredUser[], id: string, email: string, username: string, npl = "") {
  if (npl && all.some((u) => u.id !== id && padNpl(u.npl) === npl)) throw new UserDuplicate("Another doctor already has this NPL number");
  if (all.some((u) => u.id !== id && email && u.email.toLowerCase() === email)) throw new UserDuplicate("A user with this email already exists");
  if (all.some((u) => u.id !== id && u.username.toLowerCase() === username)) throw new UserDuplicate("This username / phone is already used");
}

export async function assertDoctorFree(npl: string, phone: string, email = "") {
  checkDuplicate(await load(), "", email.trim().toLowerCase(), phone.trim().toLowerCase(), padNpl(npl));
}

/**
 * A doctor was just created in the ERP: keep the fields the ERP has no column for
 * (email, specialty, designation, organization, address, BMDC) on this website,
 * linked to the ERP user. The typed password is kept as bcrypt hash + AES-GCM (never plain text),
 * so it can be sent to the ERP again later (getPasswordForErp).
 */
export function saveErpDoctorExtras(f: DoctorCreateForm, erpUserId: number | null, createdBy: number): Promise<void> {
  assertSecretKey();
  return locked(async () => {
    const all = await load();
    const user: StoredUser = {
      name: f.name.trim(),
      email: f.email.trim().toLowerCase(),
      username: f.phone.trim(),
      type: "Doctor",
      specialty: f.specialty,
      designation: f.designation,
      organization: f.organization,
      chamber: f.chambers[0]?.name.trim() ?? "",
      address: f.address,
      npl: padNpl(f.npl),
      bmdc: f.bmdc,
      id: crypto.randomUUID(),
      passwordHash: await bcrypt.hash(f.password, 12),
      passwordEnc: encryptSecret(f.password),
      isActive: true,
      erpStatus: "synced",
      ...(erpUserId ? { erpUserId } : {}),
      createdBy,
      createdAt: new Date().toISOString(),
    };
    await save([user, ...all]);
  });
}

export function createLocalUser(f: UserForm, createdBy: number): Promise<PublicUser> {
  assertSecretKey(); // fail early with a clear message if the key is missing
  return locked(async () => {
    const all = await load();
    const email = f.email.trim().toLowerCase();
    const npl = padNpl(f.npl);
    checkDuplicate(all, "", email, f.username.trim().toLowerCase(), npl);
    const { password, ...rest } = f;
    const user: StoredUser = {
      ...rest,
      email,
      npl,
      id: crypto.randomUUID(),
      passwordHash: await bcrypt.hash(password, 12),
      passwordEnc: encryptSecret(password),
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
  if (f.password) assertSecretKey();
  return locked(async () => {
    const all = await load();
    const i = all.findIndex((u) => u.id === id);
    if (i < 0) throw new UserNotFound();
    const email = f.email.trim().toLowerCase();
    const npl = padNpl(f.npl);
    checkDuplicate(all, id, email, f.username.trim().toLowerCase(), npl);
    const { password, ...rest } = f;
    all[i] = {
      ...all[i],
      ...rest,
      email,
      npl,
      passwordHash: password ? await bcrypt.hash(password, 12) : all[i].passwordHash,
      passwordEnc: password ? encryptSecret(password) : all[i].passwordEnc,
      updatedAt: new Date().toISOString(),
    };
    await save(all);
    await setChamberDocCode(id, npl);
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
    await deleteChambersOfUser(id);
  });
}

/** Find a doctor by NPL number ("8371" and "0000008371" both work) */
export async function findDoctorByNpl(npl: string): Promise<PublicUser | null> {
  const key = padNpl(npl);
  if (!key) return null;
  const u = (await load()).find((x) => x.type === "Doctor" && padNpl(x.npl) === key);
  return u ? toPublic(u) : null;
}

/**
 * FOR THE ERP MIGRATION ONLY (server side). Returns the user's real password,
 * or null for older users saved before encryption was added (give them a new password).
 * Never return this from an API to the browser.
 */
export async function getPasswordForErp(id: string): Promise<string | null> {
  const u = (await load()).find((x) => x.id === id);
  if (!u) throw new UserNotFound();
  return u.passwordEnc ? decryptSecret(u.passwordEnc) : null;
}
