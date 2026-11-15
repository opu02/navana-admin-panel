import { z } from "zod";

// The old system counts licenses in days (e.g. "30 Days", "5000 Days")
export const LICENSE_UNITS = ["Days"] as const;

export const licenseSchema = z.object({
  duration: z.coerce.number().int("Duration must be a whole number").min(1, "Duration must be at least 1").max(36500, "Duration is too long"),
  unit: z.enum(LICENSE_UNITS),
  quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(500, "You can create at most 500 at a time"),
  backupPermission: z.boolean(),
});
export type LicenseForm = z.input<typeof licenseSchema>;
export type LicenseData = z.output<typeof licenseSchema>;

export type License = {
  id: string;
  key: string;
  duration: number;
  unit: (typeof LICENSE_UNITS)[number];
  backupPermission: boolean;
  status: "unused" | "used" | "disabled";
  // filled when a doctor activates the license in the app (from the ERP later)
  usedBy?: { name: string; phone: string; email: string } | null;
  regDate?: string | null;
  validTill?: string | null;
  createdBy: number;
  createdAt: string;
  batchId: string;
};
