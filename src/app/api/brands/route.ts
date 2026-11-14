import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { brandSchema } from "@/lib/brand-schema";
import { BadReference, BrandDuplicate, createBrand, listBrands } from "@/lib/brand-store";
import type { BrandView } from "@/lib/brand-types";

const VIEWS: BrandView[] = ["all", "system", "doctor", "inactive"];

// GET /api/brands?search=&view=all&companyId=&page=1&pageSize=25&refresh=1
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession();
    const sp = req.nextUrl.searchParams;
    const view = (VIEWS.includes(sp.get("view") as BrandView) ? sp.get("view") : "all") as BrandView;
    return NextResponse.json(
      await listBrands(s, {
        search: (sp.get("search") ?? "").slice(0, 100),
        view,
        companyId: (sp.get("companyId") ?? "").slice(0, 200),
        page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
        pageSize: Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize")) || 25))),
        refresh: sp.get("refresh") === "1",
      })
    );
  });
}

// POST /api/brands  → add a new brand
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = brandSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await createBrand(s, parsed.data), { status: 201 });
    } catch (e) {
      if (e instanceof BrandDuplicate) return jsonError(409, "This brand (same name, form, strength and company) already exists");
      if (e instanceof BadReference) return jsonError(400, e.message);
      throw e;
    }
  });
}
