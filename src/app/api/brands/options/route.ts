import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getBrandOptions } from "@/lib/brand-store";

// GET /api/brands/options → generics, companies, forms, strengths for the dropdowns
export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json(await getBrandOptions(s));
  });
}
