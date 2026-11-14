import { z } from "zod";

export const masterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300, "Name can be at most 300 characters"),
  extra: z.string().trim().max(5000, "Text can be at most 5000 characters"),
});
export type MasterForm = z.infer<typeof masterSchema>;
