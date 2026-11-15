import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { licenseSchema } from "@/lib/license-schema";
import { createLicenses, listLicenses } from "@/lib/license-store";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return NextResponse.json(await listLicenses());
  });
}

// POST /api/licenses { duration, unit, quantity, backupPermission } → creates `quantity` keys
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = licenseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    return NextResponse.json(await createLicenses(parsed.data, s.userId), { status: 201 });
  });
}
