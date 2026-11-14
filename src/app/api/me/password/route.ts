import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, jsonError } from "@/lib/api";
import { deleteSession, requireSession } from "@/lib/session";
import { changeLocalPassword } from "@/lib/local-admins";

const schema = z.object({
  oldPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100)
    .regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
});

// POST /api/me/password
// - Panel admin: really changes the password (bcrypt hash in data/local-admins.json), then logs out
// - ERP user: NOT available yet (the ERP has no "change password" API)
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "The new password does not meet the rules.");
    if (parsed.data.oldPassword === parsed.data.newPassword) return jsonError(400, "New password must be different from the old one.");
    if (s.kind !== "local") {
      return jsonError(501, "Changing an ERP user's password is not available yet. The ERP needs a \"change password\" API — please ask the ERP team.");
    }
    const r = await changeLocalPassword(s.email, parsed.data.oldPassword, parsed.data.newPassword);
    if (r === "wrong-old") return jsonError(400, "Old password is incorrect.");
    if (r === "not-found") return jsonError(404, "Admin not found.");
    deleteSession(s.id); // sign out after a password change
    return NextResponse.json({ ok: true });
  });
}
