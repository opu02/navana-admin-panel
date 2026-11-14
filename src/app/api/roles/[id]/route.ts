import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { roleSchema } from "@/lib/role-schema";
import { RoleDuplicate, RoleNotFound, deleteRole, updateRole } from "@/lib/role-store";

type Ctx = { params: Promise<{ id: string }> };
const ID = /^[A-Za-z0-9_\-]{1,100}$/;

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await ctx.params;
    if (!ID.test(id)) return jsonError(404, "Role not found");
    const parsed = roleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await updateRole(id, parsed.data));
    } catch (e) {
      if (e instanceof RoleNotFound) return jsonError(404, "Role not found");
      if (e instanceof RoleDuplicate) return jsonError(409, "This role name already exists");
      throw e;
    }
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await ctx.params;
    if (!ID.test(id)) return jsonError(404, "Role not found");
    try {
      await deleteRole(id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof RoleNotFound) return jsonError(404, "Role not found");
      throw e;
    }
  });
}
