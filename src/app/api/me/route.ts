import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, jsonError } from "@/lib/api";
import { patchSession, requireSession } from "@/lib/session";
import { updateLocalProfile } from "@/lib/local-admins";

// GET /api/me → the logged-in user (never includes the ERP token)
export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({
      userId: s.userId, name: s.name, email: s.email, phone: s.phone, roleId: s.roleId, roleName: s.roleName,
      kind: s.kind,
    });
  });
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().regex(/^01[3-9]\d{8}$/),
  email: z.string().trim().email().max(100),
  details: z.string().max(500).optional(),
});

// PUT /api/me → update name / phone / email
// - Panel admin: saved in data/local-admins.json
// - ERP user: NOT available yet (the ERP has no "update user" API)
export async function PUT(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = profileSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Please check the form fields.");
    if (s.kind !== "local") {
      return jsonError(501, "Saving an ERP user's profile is not available yet. The ERP needs an \"update user\" API — please ask the ERP team.");
    }
    const r = await updateLocalProfile(s.email, parsed.data);
    if (r === "email-taken") return jsonError(409, "This email is already used by another admin.");
    if (!r) return jsonError(404, "Admin not found.");
    patchSession(s.id, { name: r.name, email: r.email, phone: r.phone });
    return NextResponse.json({ ok: true });
  });
}
