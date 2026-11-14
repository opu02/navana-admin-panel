import { z } from "zod";

export const USER_TYPES = ["Doctor", "Admin"] as const;

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[A-Za-z]/, "Password must have at least one letter")
  .regex(/\d/, "Password must have at least one number");

const base = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email").max(100),
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
  npl: z.string().trim().max(30, "Too long").regex(/^[0-9]*$/, "NPL number can only have digits"),
  bmdc: z.string().trim().max(30, "Too long").regex(/^[A-Za-z0-9-]*$/, "BMDC can only have letters, numbers and -"),
});

const nplRule = (d: { type: string; npl: string }) => d.type !== "Doctor" || d.npl.length > 0;
const nplMsg = { path: ["npl"], message: "NPL number is required for doctors" };

// Same rules on the page and on the server
export const userSchema = base.refine(nplRule, nplMsg);
/** Edit: password may be left empty (= keep the old one) */
export const userUpdateSchema = base.extend({ password: z.union([z.literal(""), password]) }).refine(nplRule, nplMsg);

export type UserForm = z.infer<typeof userSchema>;
