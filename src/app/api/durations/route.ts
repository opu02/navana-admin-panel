import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { durationSchema } from "@/lib/duration-schema";
import { DurationDuplicate, createDuration, listDurations } from "@/lib/duration-store";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession();
    const sp = req.nextUrl.searchParams;
    return NextResponse.json(
      await listDurations(s, {
        search: (sp.get("search") ?? "").slice(0, 100),
        inactive: sp.get("inactive") === "1",
        page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
        pageSize: Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize")) || 25))),
        refresh: sp.get("refresh") === "1",
      })
    );
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = durationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await createDuration(s, parsed.data), { status: 201 });
    } catch (e) {
      if (e instanceof DurationDuplicate) return jsonError(409, "This duration already exists");
      throw e;
    }
  });
}
