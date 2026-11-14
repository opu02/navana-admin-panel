import { z } from "zod";
import { ACTIONS } from "./role-types";

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(100, "Role name is too long"),
  actions: z.array(z.enum(ACTIONS)).min(1, "Please select at least one role type").max(ACTIONS.length),
});
export type RoleForm = z.infer<typeof roleSchema>;

export const permissionsSchema = z.object({
  userId: z.string().min(1).max(100),
  permissions: z.record(z.string().max(100), z.record(z.string().max(20), z.boolean())), // cleaned on the server
});
