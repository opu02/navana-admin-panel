import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { roleSchema } from "@/lib/role-schema";
import { RoleDuplicate, createRole, listRoles } from "@/lib/role-store";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return NextResponse.json(await listRoles());
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireSession();
    const parsed = roleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await createRole(parsed.data), { status: 201 });
    } catch (e) {
      if (e instanceof RoleDuplicate) return jsonError(409, "This role name already exists");
      throw e;
    }
  });
}
