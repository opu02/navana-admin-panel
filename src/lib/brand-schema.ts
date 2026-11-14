import { z } from "zod";

// Same rules on the page and on the server
export const brandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(200, "Brand name is too long"),
  formId: z.string().max(200),
  form: z.string().trim().max(100, "Form is too long"),
  strengthId: z.string().max(200),
  strength: z.string().trim().max(100, "Strength is too long"),
  genericId: z.string().min(1, "Please select a generic").max(200),
  companyId: z.string().min(1, "Please select a company").max(200),
  npsCode: z
    .string()
    .trim()
    .max(50, "NPS Code can be at most 50 characters")
    .regex(/^[A-Za-z0-9\-_/ ]*$/, "NPS Code can only have letters, numbers, - _ /"),
});

export type BrandForm = z.infer<typeof brandSchema>;
