// Reversible encryption (AES-256-GCM) for secrets the ERP needs as plain text later,
// e.g. a doctor's password, which the ERP stores as plain text.
// The key is in .env.local (PASSWORD_ENC_KEY), never in data files or in Git.
// If someone gets data/users.json WITHOUT the key, they can't read the passwords.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1:";

export class SecretKeyMissing extends Error {}

function key(): Buffer {
  const raw = process.env.PASSWORD_ENC_KEY?.trim() ?? "";
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new SecretKeyMissing(
      "PASSWORD_ENC_KEY is missing or wrong in .env.local. Make one with: node scripts/make-enc-key.mjs"
    );
  }
  return k;
}

/** "v1:<iv>.<tag>.<data>" (all base64) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(box: string): string {
  if (!box.startsWith(PREFIX)) throw new Error("Unknown secret format");
  const [iv, tag, data] = box.slice(PREFIX.length).split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

/** Check at startup / before saving, so a missing key gives a clear error */
export function assertSecretKey() {
  key();
}
