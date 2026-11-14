import { NextResponse } from "next/server";
import { genericSchema } from "@/lib/generic-schema";
import {
  DuplicateError, NotFoundError, deleteGeneric, getGeneric, updateGeneric,
} from "@/lib/generic-store";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const notFound = () => NextResponse.json({ message: "Generic not found" }, { status: 404 });

export async function GET(_: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    return NextResponse.json(await getGeneric(id));
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    throw e;
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const parsed = genericSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateGeneric(id, parsed.data.name));
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    if (e instanceof DuplicateError) {
      return NextResponse.json({ message: "This generic already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    await deleteGeneric(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) return notFound();
    throw e;
  }
}
