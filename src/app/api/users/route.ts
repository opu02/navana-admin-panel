import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { userSchema } from "@/lib/user-schema";
import { UserDuplicate, createLocalUser, listLocalUsers } from "@/lib/user-store";

// POST /api/users → create a user
export async function POST(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = userSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");

    // TEMPORARY: saved on this PC (data/users.json) because the ERP has no create-user API yet.
    // TODO: when the ERP gives the API, call it here with erpFetch() instead (over HTTPS).
    try {
      return NextResponse.json(await createLocalUser(parsed.data, s.userId), { status: 201 });
    } catch (e) {
      if (e instanceof UserDuplicate) return jsonError(409, e.message);
      throw e;
    }
  });
}

// GET /api/users?type=Admin|Doctor&full=1 → users saved on the website (never passwords)
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireSession();
    const type = req.nextUrl.searchParams.get("type");
    let users = await listLocalUsers();
    if (type === "Admin" || type === "Doctor") users = users.filter((u) => u.type === type);
    if (req.nextUrl.searchParams.get("full") === "1") return NextResponse.json(users);
    return NextResponse.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, type: u.type })));
  });
}
