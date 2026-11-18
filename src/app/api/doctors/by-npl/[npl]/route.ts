import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { padNpl } from "@/lib/user-schema";
import { findDoctorByNpl } from "@/lib/user-store";
import { listChambers } from "@/lib/chamber-store";

type Ctx = { params: Promise<{ npl: string }> };

// GET /api/doctors/by-npl/8371  (or /0000008371) → the doctor + all chambers.
// Login required. "8371" and "0000008371" give the same doctor.
export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireSession();
    const { npl } = await ctx.params;
        if (!/^([A-Za-z]{2}\d{1,8}|\d{1,10})$/.test(npl)) return jsonError(400, "NPL must be 2 letters + digits, or digits only (max 10)");
    const doc = await findDoctorByNpl(npl);
    if (!doc) return jsonError(404, `No doctor with NPL ${padNpl(npl)}`);
    const chambers = await listChambers(doc.id);
    return NextResponse.json({
      npl: doc.npl,
      doctor: {
        id: doc.id, name: doc.name, email: doc.email, phone: doc.username, specialty: doc.specialty,
        designation: doc.designation, organization: doc.organization, bmdc: doc.bmdc,
        address: doc.address, isActive: doc.isActive, createdAt: doc.createdAt,
      },
      // Same field names as the app (doctor_chamber_table)
      chambers: chambers.map((c) => ({
        chamber_id: c.chamberId, doc_code: c.docCode, chamber_name: c.chamberName,
        chamber_address: c.chamberAddress, created_at: c.createdAt, updated_at: c.updatedAt ?? null,
      })),
    });
  });
}
