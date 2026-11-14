// Make a password hash for .env.local.  Usage:  node scripts/hash-password.mjs "your-password"
// Output is "b64:..." (base64 of a bcrypt hash) — no "$" signs, so .env can't break it.
import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}
console.log("b64:" + Buffer.from(bcrypt.hashSync(pw, 12)).toString("base64"));
