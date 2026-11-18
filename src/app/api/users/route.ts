import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { doctorCreateSchema, userSchema } from "@/lib/user-schema";
import { ErpError } from "@/lib/erp";
import { createDoctor } from "@/lib/doctor-erp";
import { loadDoctors, normPhone } from "@/lib/doctor-directory";
import { UserDuplicate, createLocalUser, listLocalUsers } from "@/lib/user-store";
import { chambersByUser } from "@/lib/chamber-store";

// POST /api/users → create a user
//  - type "Doctor": goes to the ERP (user-create + rx-doctor-chamber), see lib/doctor-erp.ts
//  - type "Admin":  TEMPORARY, saved on this PC (data/users.json), the ERP has no API for admins
export async function POST(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession();
    const body = await req.json().catch(() => null);

    if ((body as { type?: unknown } | null)?.type === "Doctor") {
      const parsed = doctorCreateSchema.safeParse(body);
      if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
      try {
        return NextResponse.json(await createDoctor(s, parsed.data), { status: 201 });
      } catch (e) {
        if (e instanceof UserDuplicate) return jsonError(409, e.message);
        // a 403 from the ERP means "this account may not do that", not "your session is over": don't log the admin out
        if (e instanceof ErpError && e.status === 403) {
          return jsonError(502, "The ERP refused this request. The panel's ERP account may not be allowed to create doctors.");
        }
        throw e;
      }
    }

    const parsed = userSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data");
    try {
      return NextResponse.json(await createLocalUser(parsed.data, s.userId), { status: 201 });
    } catch (e) {
      if (e instanceof UserDuplicate) return jsonError(409, e.message);
      throw e;
    }
  });
}

// GET /api/users?type=Admin|Doctor&full=1 → never passwords
//  - type=Doctor: the doctors from the ERP (lib/doctor-directory.ts) + old website-only doctors. ?refresh=1 reloads from the ERP.
//  - otherwise:   users saved on the website (Admin users)
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession();
    const q = req.nextUrl.searchParams;
    const type = q.get("type");
    const full = q.get("full") === "1";

    if (type === "Doctor") {
      let erpDoctors;
      try {
        erpDoctors = await loadDoctors(s, q.get("refresh") === "1");
      } catch (e) {
        // 403 = this ERP account may not read the user list: don't log the admin out
        if (e instanceof ErpError && e.status === 403) {
          return jsonError(502, "The ERP refused to send the doctor list. The panel's ERP account may not be allowed to read it.");
        }
        throw e;
      }
            const ch = full ? await chambersByUser() : null;
      const local = await listLocalUsers();
      // details the ERP has no column for (email, specialty, designation, organization, address, BMDC), saved when the doctor was created
      const extraById = new Map<number, (typeof local)[number]>();
      const extraByPhone = new Map<string, (typeof local)[number]>();
      for (const u of local) {
        if (u.type !== "Doctor" || u.erpStatus !== "synced") continue;
        if (u.erpUserId) extraById.set(u.erpUserId, u);
        extraByPhone.set(normPhone(u.username), u);
      }
      const erpWithExtras = erpDoctors.map((d) => {
        const x = extraById.get(d.erpUserId) ?? extraByPhone.get(normPhone(d.username));
        return x
          ? { ...d, email: d.email || x.email, specialty: x.specialty, designation: x.designation, organization: x.organization, bmdc: x.bmdc, address: x.address }
          : d;
      });
      const websiteOnly = local
        .filter((u) => u.type === "Doctor" && u.erpStatus !== "synced") // old records that never reached the ERP
        .map((u) => ({ ...u, ...(ch ? { chambers: ch.get(u.id) ?? [] } : {}) }));
      type Row = { id: string; name: string; email: string; type: string; createdAt: string };
      const all: (Row & Record<string, unknown>)[] = [...websiteOnly, ...erpWithExtras];
      all.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)); // newest first
      return NextResponse.json(full ? all : all.map((u) => ({ id: u.id, name: u.name, email: u.email, type: u.type })));
    }

    let users = await listLocalUsers();
    if (type === "Admin") users = users.filter((u) => u.type === type);
    if (full) {
      const ch = await chambersByUser();
      return NextResponse.json(users.map((u) => ({ ...u, chambers: ch.get(u.id) ?? [] })));
    }
    return NextResponse.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, type: u.type })));
  });
}
