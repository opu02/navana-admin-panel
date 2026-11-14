import { z } from "zod";

// Same rules on the page and in the API
export const genericSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Generic name is required")
    .min(2, "Generic name is too short")
    .max(300, "Generic name can be at most 300 characters"),
});

export type GenericForm = z.infer<typeof genericSchema>;
