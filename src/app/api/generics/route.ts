import { NextResponse, type NextRequest } from "next/server";
import { genericSchema } from "@/lib/generic-schema";
import { DuplicateError, createGeneric, listGenerics } from "@/lib/generic-store";

// GET /api/generics?search=&page=1&pageSize=25
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize")) || 25)));
  const search = (sp.get("search") ?? "").slice(0, 100);
  return NextResponse.json(await listGenerics(search, page, pageSize));
}

// POST /api/generics  { name }
export async function POST(req: Request) {
  const parsed = genericSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createGeneric(parsed.data.name), { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateError) {
      return NextResponse.json({ message: "This generic already exists" }, { status: 409 });
    }
    throw e;
  }
}
