import { z } from "zod";

/**
 * NPL number is ALWAYS exactly 10 characters.
 *  - 2 letters + digits (e.g. BH2771): zeros go between the letters and the digits → "BH00002771".
 *  - Digits only (e.g. 8371): zeros go in front → "0000008371".
 *  - Already 10 characters → left as it is. Letters are saved in capitals. Empty stays empty.
 */
export const NPL_LENGTH = 10;
export function padNpl(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\s+/g, "").toUpperCase();
  const m = /^([A-Z]{2})(\d+)$/.exec(s);
  if (m) return m[1] + m[2].padStart(NPL_LENGTH - 2, "0");
  if (/^\d+$/.test(s)) return s.padStart(NPL_LENGTH, "0");
  return s;
}

export const USER_TYPES = ["Doctor", "Admin"] as const;

// Any password the user wants (no length / letter / number rule)
const password = z.string().min(1, "Password is required").max(100, "Password is too long");

const base = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  // Optional: empty is fine, but if given it must be a real email
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email").max(100)]),
  username: z
    .string()
    .trim()
    .min(3, "Username / phone is required (at least 3 characters)")
    .max(50, "Too long")
    .regex(/^[A-Za-z0-9._@+-]+$/, "Only letters, numbers and . _ @ + - are allowed"),
  password,
  type: z.enum(USER_TYPES, { message: "Please select a type" }),
  specialty: z.string().trim().max(150, "Too long"),
  designation: z.string().trim().max(150, "Too long"),
  organization: z.string().trim().max(200, "Too long"),
  chamber: z.string().trim().max(200, "Too long"),
  address: z.string().trim().max(300, "Too long"),
  npl: z.string().trim().regex(/^([A-Za-z]{2}[0-9]{1,8}|[0-9]{1,10})?$/, "NPL must be 10 characters: 2 letters + digits (BH2771) or digits only (8371). Maximum 10."),
  bmdc: z.string().trim().max(30, "Too long").regex(/^[A-Za-z0-9-]*$/, "BMDC can only have letters, numbers and -"),
});

const nplRule = (d: { type: string; npl: string }) => d.type !== "Doctor" || d.npl.length > 0;
const nplMsg = { path: ["npl"], message: "NPL number is required for doctors" };

// Same rules on the page and on the server
export const userSchema = base.refine(nplRule, nplMsg);
/** Edit: password may be left empty (= keep the old one) */
export const userUpdateSchema = base.extend({ password: z.union([z.literal(""), password]) }).refine(nplRule, nplMsg);

export type UserForm = z.infer<typeof userSchema>;

// ---------------- Doctor created through the ERP (rx-data/user-create) ----------------
// The ERP only takes: doc_code (NPL), full_name, phone_no and the chambers.
// Password: typed by the admin. It is sent to the ERP as "password" and kept encrypted here.
// For now the ERP ignores it and sets the app password = the phone number, until the ERP reads this field.
// The other fields (email, specialty, designation, organization, address, BMDC) are kept
// on this website next to the ERP doctor (data/users.json, erpStatus "synced").
// A doctor can have as many chambers as he wants: there is no maximum.

const chamberRow = z.object({
  name: z.string().trim().min(1, "Chamber name is required").max(150, "Too long"),
  address: z.string().trim().max(300, "Too long"),
});

export const doctorCreateSchema = z
  .object({
    type: z.literal("Doctor"),
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email").max(100)]),
    phone: z.string().trim().regex(/^01[3-9]\d{8}$/, "Enter a valid phone number (e.g. 01712345678)"),
    password,
    specialty: z.string().trim().max(150, "Too long"),
    designation: z.string().trim().max(150, "Too long"),
    organization: z.string().trim().max(200, "Too long"),
    address: z.string().trim().max(300, "Too long"),
    npl: z
      .string()
      .trim()
      .min(1, "NPL number is required for doctors")
      .regex(/^([A-Za-z]{2}[0-9]{1,8}|[0-9]{1,10})$/, "NPL must be 2 letters + digits (BH2771) or digits only (8371). Maximum 10."),
    bmdc: z.string().trim().max(30, "Too long").regex(/^[A-Za-z0-9-]*$/, "BMDC can only have letters, numbers and -"),
    chambers: z.array(chamberRow).min(1, "Add at least one chamber"),
  })
  .refine((d) => new Set(d.chambers.map((c) => c.name.trim().toLowerCase())).size === d.chambers.length, {
    path: ["chambers"],
    message: "Two chambers have the same name",
  });

export type DoctorCreateForm = z.infer<typeof doctorCreateSchema>;
