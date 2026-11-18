import { z } from "zod";

export const chamberSchema = z.object({
  chamberName: z.string().trim().min(1, "Chamber name is required").max(150, "Too long"),
  chamberAddress: z.string().trim().max(300, "Too long"),
});
export type ChamberForm = z.infer<typeof chamberSchema>;
