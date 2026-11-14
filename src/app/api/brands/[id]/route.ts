import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { brandSchema } from "@/lib/brand-schema";
import {
  BadReference, BrandDuplicate, BrandNotFound, deactivateBrand, getBrand, updateBrand,
} from "@/lib/brand-store";

type Ctx = { params: Promise<{ id: string }> };
const ID = /^[A-Za-z0-9_\-]{1,200}$/;

async function idOf(ctx: Ctx) {
  const id = decodeURIComponent((await ctx.params).id);
  return ID.test(id) ? id : null;
}
const notFound = () => jsonError(404, "Brand not found");

export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    try {
      return NextResponse.json(await getBrand(s, id));
    } catch (e) {
      if (e instanceof BrandNotFound) return notFound();
      throw e;
    }
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    const parsed = brandSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await updateBrand(s, id, parsed.data));
    } catch (e) {
      if (e instanceof BrandNotFound) return notFound();
      if (e instanceof BrandDuplicate) return jsonError(409, "This brand (same name, form, strength and company) already exists");
      if (e instanceof BadReference) return jsonError(400, e.message);
      throw e;
    }
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    try {
      await deactivateBrand(s, id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof BrandNotFound) return notFound();
      throw e;
    }
  });
}
