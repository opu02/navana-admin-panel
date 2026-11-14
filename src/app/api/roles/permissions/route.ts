import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { permissionsSchema } from "@/lib/role-schema";
import { getPermissions, setPermissions } from "@/lib/role-store";
import { listLocalUsers } from "@/lib/user-store";

// GET /api/roles/permissions?userId=...
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireSession();
    const userId = (req.nextUrl.searchParams.get("userId") ?? "").slice(0, 100);
    if (!userId) return jsonError(400, "Please select a user");
    return NextResponse.json(await getPermissions(userId));
  });
}

// PUT /api/roles/permissions { userId, permissions }
export async function PUT(req: Request) {
  return handle(async () => {
    await requireSession();
    const parsed = permissionsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Invalid data");
    const users = await listLocalUsers();
    if (!users.some((u) => u.id === parsed.data.userId)) return jsonError(404, "User not found");
    return NextResponse.json(await setPermissions(parsed.data.userId, parsed.data.permissions));
  });
}
