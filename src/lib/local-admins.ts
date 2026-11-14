// Panel-only admin accounts (not in the ERP).
// Stored in data/local-admins.json (git-ignored). Passwords are bcrypt hashes, never plain text.
// The first admin is created from .env.local (PANEL_ADMIN_EMAIL + PANEL_ADMIN_PASSWORD_HASH).
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export type LocalAdmin = { email: string; name: string; phone: string; passwordHash: string; updatedAt: string };

const FILE = path.join(process.cwd(), "data", "local-admins.json");
// a real-looking hash so wrong emails take the same time as right ones
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO6O3H2Yq5mRrQhQyqk0f6c3xYxHnq2by";

async function readAll(): Promise<LocalAdmin[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalAdmin[];
  } catch {
    const email = process.env.PANEL_ADMIN_EMAIL?.trim().toLowerCase();
    const raw = process.env.PANEL_ADMIN_PASSWORD_HASH?.trim() ?? "";
    // "b64:..." = base64 of a bcrypt hash (made by scripts/hash-password.mjs)
    const hash = raw.startsWith("b64:") ? Buffer.from(raw.slice(4), "base64").toString("utf8") : raw;
    if (hash && !hash.startsWith("$2")) {
      console.error("[auth] PANEL_ADMIN_PASSWORD_HASH is not valid. Run: node scripts/hash-password.mjs \"YourPassword\"");
      return [];
    }
    if (!email || !hash) return [];
    const first: LocalAdmin[] = [{
      email, name: process.env.PANEL_ADMIN_NAME?.trim() || "Panel Admin",
      phone: process.env.PANEL_ADMIN_PHONE?.trim() || "", passwordHash: hash, updatedAt: new Date().toISOString(),
    }];
    await writeAll(first);
    return first;
  }
}

async function writeAll(list: LocalAdmin[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export async function findLocalAdmin(email: string) {
  const e = email.trim().toLowerCase();
  return (await readAll()).find((a) => a.email === e) ?? null;
}

/** Check email + password. Always runs bcrypt, so timing doesn't reveal which emails exist. */
export async function verifyLocalAdmin(email: string, password: string) {
  const admin = await findLocalAdmin(email);
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  return ok && admin ? admin : null;
}

export async function changeLocalPassword(email: string, oldPassword: string, newPassword: string) {
  const list = await readAll();
  const i = list.findIndex((a) => a.email === email.trim().toLowerCase());
  if (i < 0) return "not-found" as const;
  if (!(await bcrypt.compare(oldPassword, list[i].passwordHash))) return "wrong-old" as const;
  list[i] = { ...list[i], passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date().toISOString() };
  await writeAll(list);
  return "ok" as const;
}

export async function updateLocalProfile(email: string, data: { name: string; phone: string; email: string }) {
  const list = await readAll();
  const i = list.findIndex((a) => a.email === email.trim().toLowerCase());
  if (i < 0) return null;
  const newEmail = data.email.trim().toLowerCase();
  if (newEmail !== list[i].email && list.some((a) => a.email === newEmail)) return "email-taken" as const;
  list[i] = { ...list[i], name: data.name.trim(), phone: data.phone.trim(), email: newEmail, updatedAt: new Date().toISOString() };
  await writeAll(list);
  return list[i];
}
