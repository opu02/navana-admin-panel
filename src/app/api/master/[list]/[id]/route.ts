import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { MASTER, isMasterKey } from "@/lib/master-config";
import { masterSchema } from "@/lib/master-schema";
import { MasterDuplicate, MasterNotFound, deactivateMaster, getMaster, updateMaster } from "@/lib/master-store";

type Ctx = { params: Promise<{ list: string; id: string }> };
const ID = /^[A-Za-z0-9_\-]{1,200}$/;

async function parse(ctx: Ctx) {
  const { list, id: raw } = await ctx.params;
  const id = decodeURIComponent(raw);
  return isMasterKey(list) && ID.test(id) ? { list, id } : null;
}
const notFound = () => jsonError(404, "Not found");

export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const p = await parse(ctx);
    if (!p) return notFound();
    try {
      return NextResponse.json(await getMaster(s, p.list, p.id));
    } catch (e) {
      if (e instanceof MasterNotFound) return notFound();
      throw e;
    }
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const p = await parse(ctx);
    if (!p) return notFound();
    const parsed = masterSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    const extraCfg = MASTER[p.list].extra;
    if (parsed.data.extra.length > (extraCfg?.max ?? 0) && extraCfg) {
      return jsonError(400, `${extraCfg.label} can be at most ${extraCfg.max} characters`);
    }
    if (!extraCfg) parsed.data.extra = "";
    try {
      return NextResponse.json(await updateMaster(s, p.list, p.id, parsed.data));
    } catch (e) {
      if (e instanceof MasterNotFound) return notFound();
      if (e instanceof MasterDuplicate) return jsonError(409, "This name already exists");
      throw e;
    }
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const p = await parse(ctx);
    if (!p) return notFound();
    try {
      await deactivateMaster(s, p.list, p.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof MasterNotFound) return notFound();
      throw e;
    }
  });
}
