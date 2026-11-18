import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { userUpdateSchema } from "@/lib/user-schema";
import {
  UserDuplicate, UserNotFound, deleteLocalUser, getLocalUser, setLocalUserActive, updateLocalUser,
} from "@/lib/user-store";

type Ctx = { params: Promise<{ id: string }> };
const ID = /^[0-9a-f-]{36}$/i;
const notFound = () => jsonError(404, "User not found");

async function idOf(ctx: Ctx) {
  const { id } = await ctx.params;
  return ID.test(id) ? id : null;
}

const NO_ERP_EDIT = "This doctor is saved in the ERP, and the ERP has no API to edit, deactivate or delete doctors yet.";

async function isErpUser(id: string) {
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
    if (e instanceof UserNotFound) return notFound();
    if (e instanceof UserDuplicate) return jsonError(409, e.message);
    throw e;
  }
}

export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    return run(async () => NextResponse.json(await getLocalUser(id)));
  });
}

// PUT → edit (empty password = keep the old one)
export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    if (await isErpUser(id)) return jsonError(501, NO_ERP_EDIT);
    const parsed = userUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    return run(async () => NextResponse.json(await updateLocalUser(id, parsed.data)));
  });
}

// PATCH { isActive } → Activate / Deactivate
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    if (await isErpUser(id)) return jsonError(501, NO_ERP_EDIT);
    const parsed = z.object({ isActive: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Invalid data");
    return run(async () => NextResponse.json(await setLocalUserActive(id, parsed.data.isActive)));
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const id = await idOf(ctx);
    if (!id) return notFound();
    if (await isErpUser(id)) return jsonError(501, NO_ERP_EDIT);
    return run(async () => {
      await deleteLocalUser(id);
      return NextResponse.json({ ok: true });
    });
  });
}
