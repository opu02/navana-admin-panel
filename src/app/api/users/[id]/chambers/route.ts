import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { chamberSchema } from "@/lib/chamber-schema";
import { ChamberDuplicate, addChamber, listChambers } from "@/lib/chamber-store";
import { UserNotFound, getLocalUser } from "@/lib/user-store";
import { ErpError } from "@/lib/erp";
import { erpAddChamber } from "@/lib/doctor-erp";
import { fetchDocCode, getErpDoctor, invalidateDoctors } from "@/lib/doctor-directory";

type Ctx = { params: Promise<{ id: string }> };
const ID = /^[0-9a-f-]{36}$/i;
const ERP_ID = /^erp-(\d{1,12})$/; // doctors that live in the ERP

async function doctorOf(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return null;
  try {
    const u = await getLocalUser(id);
    return u.type === "Doctor" ? u : null;
  } catch (e) {
    if (e instanceof UserNotFound) return null;
    throw e;
  }
}

// GET → this doctor's chambers
export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();
    const erp = ERP_ID.exec((await ctx.params).id);
    if (erp) {
      const d = await getErpDoctor(s, Number(erp[1]));
      return d ? NextResponse.json(d.chambers) : jsonError(404, "Doctor not found");
    }
    const doc = await doctorOf(ctx);
    if (!doc) return jsonError(404, "Doctor not found");
    return NextResponse.json(await listChambers(doc.id));
  });
}

// POST { chamberName, chamberAddress } → add a chamber
export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireSession();

    // Doctor that lives in the ERP: send the chamber to rx-doctor-chamber (the ERP has no edit/delete for it)
    const erp = ERP_ID.exec((await ctx.params).id);
    if (erp) {
      const d = await getErpDoctor(s, Number(erp[1]));
      if (!d) return jsonError(404, "Doctor not found");
      const p = chamberSchema.safeParse(await req.json().catch(() => null));
      if (!p.success) return jsonError(400, p.error.issues[0]?.message ?? "Invalid data");
      const { chamberName: name, chamberAddress: address } = p.data;
      // the NPL comes from the doctor, the admin never types it. If the list has none (chambers failed to load), ask the ERP again
      const npl = d.npl || (await fetchDocCode(s, d.erpUserId));
      if (!npl) {
        return jsonError(400, "This doctor has no NPL number in the ERP yet (no chamber on file), so a chamber can't be added from here.");
      }
      if (d.chambers.some((c) => c.chamberName.trim().toLowerCase() === name.trim().toLowerCase())) {
        return jsonError(409, "This doctor already has a chamber with this name");
      }
      try {
        const r = await erpAddChamber(s, { erpUserId: d.erpUserId, docCode: npl, name, address });
        invalidateDoctors(s.userId);
        return NextResponse.json(
          { chamberId: r.erpChamberId ?? -Date.now(), docCode: npl, chamberName: name, chamberAddress: address, erpStatus: "synced" },
          { status: 201 }
        );
      } catch (e) {
        if (e instanceof ErpError && e.status === 403) {
          return jsonError(502, "The ERP refused this request. The panel's ERP account may not be allowed to add chambers.");
        }
        throw e;
      }
    }

    const doc = await doctorOf(ctx);
    if (!doc) return jsonError(404, "Doctor not found");
    const parsed = chamberSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    const { chamberName, chamberAddress } = parsed.data;
    try {
      // Doctors that live in the ERP: save the chamber there first (rx-doctor-chamber), then remember it here.
      // Older website-only doctors (erpStatus "pending") are still saved on this PC only.
      let erp: { erpChamberId: number | null } | undefined;
      if (doc.erpStatus === "synced") {
        if (!doc.erpUserId) {
          return jsonError(502, "This doctor has no ERP user id saved, so a chamber can't be sent to the ERP. Please contact the developer.");
        }
        if ((await listChambers(doc.id)).some((c) => c.chamberName.trim().toLowerCase() === chamberName.trim().toLowerCase())) {
          return jsonError(409, "This doctor already has a chamber with this name");
        }
        try {
          erp = await erpAddChamber(s, { erpUserId: doc.erpUserId, docCode: doc.npl, name: chamberName, address: chamberAddress });
        } catch (e) {
          if (e instanceof ErpError && e.status === 403) {
            return jsonError(502, "The ERP refused this request. The panel's ERP account may not be allowed to add chambers.");
          }
          throw e;
        }
      }
      const c = await addChamber(doc.id, doc.npl, chamberName, chamberAddress, s.userId, erp);
      return NextResponse.json(c, { status: 201 });
    } catch (e) {
      if (e instanceof ChamberDuplicate) return jsonError(409, e.message);
      throw e;
    }
  });
}
