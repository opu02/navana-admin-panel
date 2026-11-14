import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { durationSchema } from "@/lib/duration-schema";
import { DurationDuplicate, DurationNotFound, deactivateDuration, getDuration, updateDuration } from "@/lib/duration-store";

type Ctx = { params: Promise<{ id: string }> };
const ID = /^[A-Za-z0-9_\-]{1,200}$/;
async function idOf(ctx: Ctx) {
  const id = decodeURIComponent((await ctx.params).id);
  return ID.test(id) ? id : null;
}
const notFound = () => jsonError(404, "Duration not found");

export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    try { return NextResponse.json(await getDuration(s, id)); }
    catch (e) { if (e instanceof DurationNotFound) return notFound(); throw e; }
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    const parsed = durationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try { return NextResponse.json(await updateDuration(s, id, parsed.data)); }
    catch (e) {
      if (e instanceof DurationNotFound) return notFound();
      if (e instanceof DurationDuplicate) return jsonError(409, "This duration already exists");
      throw e;
    }
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    try { await deactivateDuration(s, id); return NextResponse.json({ ok: true }); }
    catch (e) { if (e instanceof DurationNotFound) return notFound(); throw e; }
  });
}
