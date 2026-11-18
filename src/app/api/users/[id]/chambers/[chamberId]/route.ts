import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { chamberSchema } from "@/lib/chamber-schema";
import { UserNotFound, getLocalUser } from "@/lib/user-store";
import { ChamberDuplicate, ChamberNotFound, deleteChamber, updateChamber } from "@/lib/chamber-store";

type Ctx = { params: Promise<{ id: string; chamberId: string }> };
const ID = /^[0-9a-f-]{36}$/i;

async function idsOf(ctx: Ctx) {
  const { id, chamberId } = await ctx.params;
  const cid = Number(chamberId);
  return ID.test(id) && Number.isInteger(cid) && cid > 0 ? { id, cid } : null;
}

const NO_ERP_EDIT = "The ERP has no API to edit or delete a chamber yet, so chambers of ERP doctors can only be added.";

/** true when this doctor lives in the ERP (we can't change chambers there) */
async function isErpDoctor(id: string) {
  try {
    return (await getLocalUser(id)).erpStatus === "synced";
  } catch (e) {
    if (e instanceof UserNotFound) return false;
    throw e;
  }
}

async function run(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ChamberNotFound) return jsonError(404, "Chamber not found");
    if (e instanceof ChamberDuplicate) return jsonError(409, e.message);
    throw e;
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const ids = await idsOf(ctx);
    if (!ids) return jsonError(404, "Chamber not found");
    if (await isErpDoctor(ids.id)) return jsonError(501, NO_ERP_EDIT);
    const parsed = chamberSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    return run(async () =>
      NextResponse.json(await updateChamber(ids.id, ids.cid, parsed.data.chamberName, parsed.data.chamberAddress, s.userId)));
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const ids = await idsOf(ctx);
    if (!ids) return jsonError(404, "Chamber not found");
    if (await isErpDoctor(ids.id)) return jsonError(501, NO_ERP_EDIT);
    return run(async () => {
      await deleteChamber(ids.id, ids.cid);
      return NextResponse.json({ ok: true });
    });
  });
}
