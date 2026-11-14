import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { MASTER, isMasterKey } from "@/lib/master-config";
import { masterSchema } from "@/lib/master-schema";
import { MasterDuplicate, createMaster, listMaster } from "@/lib/master-store";

type Ctx = { params: Promise<{ list: string }> };

// GET /api/master/form?search=&inactive=0&page=1&pageSize=25&refresh=1
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const { list } = await ctx.params;
    if (!isMasterKey(list)) return jsonError(404, "Not found");
    const sp = req.nextUrl.searchParams;
    return NextResponse.json(
      await listMaster(s, list, {
        search: (sp.get("search") ?? "").slice(0, 100),
        inactive: sp.get("inactive") === "1",
        page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
        pageSize: Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize")) || 25))),
        refresh: sp.get("refresh") === "1",
      })
    );
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const { list } = await ctx.params;
    if (!isMasterKey(list)) return jsonError(404, "Not found");
    const parsed = masterSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    const extraCfg = MASTER[list].extra;
    if (parsed.data.extra.length > (extraCfg?.max ?? 0) && extraCfg) {
      return jsonError(400, `${extraCfg.label} can be at most ${extraCfg.max} characters`);
    }
    if (!extraCfg) parsed.data.extra = "";
    try {
      return NextResponse.json(await createMaster(s, list, parsed.data), { status: 201 });
    } catch (e) {
      if (e instanceof MasterDuplicate) return jsonError(409, "This name already exists");
      throw e;
    }
  });
}
