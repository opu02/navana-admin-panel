import { z } from "zod";

export const durationSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Please enter a number")
    .regex(/^\d{1,4}$/, "Duration must be a whole number (e.g. 7)"),
  type: z.enum(["D", "W", "M"], { message: "Please select a type" }),
});
export type DurationForm = z.infer<typeof durationSchema>;
