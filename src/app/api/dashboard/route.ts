import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { listMaster } from "@/lib/master-store";
import { listDurations } from "@/lib/duration-store";
import { listLocalUsers } from "@/lib/user-store";
import { listLicenses } from "@/lib/license-store";
import type { MasterKey } from "@/lib/master-config";

// GET /api/dashboard → counts for the dashboard (brands are loaded separately: they can be slow the first time)
const LISTS: { key: MasterKey; label: string; href: string }[] = [
  { key: "generic", label: "Generic", href: "/system/generic" },
  { key: "diagnosis", label: "Diagnosis", href: "/system/diagnosis" },
  { key: "procedure", label: "Procedure", href: "/system/procedure" },
  { key: "cc", label: "Chief Complaint", href: "/system/cc" },
  { key: "investigation", label: "Investigation", href: "/system/investigation" },
  { key: "oe", label: "On Examination", href: "/system/oe" },
  { key: "history", label: "History", href: "/system/history" },
  { key: "form", label: "Brand Form", href: "/system/brand-form-short" },
  { key: "dose", label: "Dose", href: "/system/dose" },
  { key: "instruction", label: "Instruction", href: "/system/instruction" },
  { key: "advice", label: "Advice", href: "/system/advice" },
  { key: "handout", label: "Handout", href: "/system/handout" },
  { key: "speciality", label: "Specialty", href: "/system/speciality" },
];

const q = { search: "", inactive: false, page: 1, pageSize: 1 };

export async function GET() {
  return handle(async () => {
    const s = await requireSession();

    const [lists, duration, users, licenses] = await Promise.all([
      Promise.allSettled(LISTS.map((l) => listMaster(s, l.key, q))),
      listDurations(s, q).then((d) => d.total).catch(() => null),
      listLocalUsers().catch(() => []),
      listLicenses().catch(() => []),
    ]);

    const master = LISTS.map((l, i) => {
      const r = lists[i];
      return { key: l.key, label: l.label, href: l.href, total: r.status === "fulfilled" ? r.value.total : null };
    });
    master.splice(10, 0, { key: "duration" as MasterKey, label: "Duration", href: "/system/duration", total: duration });

    const used = licenses.filter((l) => l.status === "used" || !!l.usedBy).length;
    return NextResponse.json({
      master,
      users: {
        admins: users.filter((u) => u.type === "Admin").length,
        doctors: users.filter((u) => u.type === "Doctor").length,
        active: users.filter((u) => u.isActive).length,
      },
      licenses: { total: licenses.length, used, unused: licenses.length - used },
    });
  });
}
