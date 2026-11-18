// Make the PASSWORD_ENC_KEY for .env.local.  Usage:  node scripts/make-enc-key.mjs
// Run it ONCE. Keep the key safe and backed up: if you lose it, saved passwords can't be read.
import { randomBytes } from "crypto";
console.log("PASSWORD_ENC_KEY=" + randomBytes(32).toString("base64"));
