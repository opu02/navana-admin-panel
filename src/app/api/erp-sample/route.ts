// TEMPORARY developer tool: shows a small sample of an ERP list, so we can see its exact fields.
// Only works for logged-in users, only in development, only for the paths listed below.
// DELETE THIS FILE before going live.
import { NextResponse, type NextRequest } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { erpFetch, erpFetchAll } from "@/lib/erp";

const ALLOWED = new Set([
  "rx-form", "rx-company", "rx-generic", "rx-brand-name", "rx-dose", "rx-duration", "rx-instruction",
  "rx-section-data",
  // guesses — Speciality is not in the Postman file
  "rx-speciality", "rx-specialty", "rx-specialities", "rx-doctor-speciality",
]);

type Any = Record<string, unknown>;

export async function GET(req: NextRequest) {
  return handle(async () => {
    if (process.env.NODE_ENV === "production") return jsonError(404, "Not found");
    const s = await requireSession();
    const name = req.nextUrl.searchParams.get("path") ?? "";
    if (!ALLOWED.has(name)) return jsonError(400, `path must be one of: ${[...ALLOWED].join(", ")}`);

    // Nested section data: show a short summary only
    if (name === "rx-section-data") {
      const data = await erpFetch<Any>("rx-data/rx-section-data", { token: s.erpToken, query: { user_id: s.userId } });
      const sections = (data?.items as Any[] | undefined) ?? [];
      const { items: _drop, ...top } = data ?? {};
      return NextResponse.json({
        path: name,
        topLevelKeys: Object.keys(data ?? {}),
        paging: top,
        sectionCount: sections.length,
        sections: sections.map((sec) => {
          const groups = (sec.items as Any[] | undefined) ?? [];
          const { items: _g, ...secInfo } = sec;
          return {
            ...secInfo,
            groupCount: groups.length,
            itemCount: groups.reduce((n, gr) => n + (((gr.items as Any[] | undefined) ?? []).length), 0),
            sampleGroups: groups.slice(0, 2).map((gr) => {
              const items = (gr.items as Any[] | undefined) ?? [];
              const { items: _i, ...grInfo } = gr;
              return { ...grInfo, itemCount: items.length, sampleItems: items.slice(0, 2) };
            }),
          };
        }),
      });
    }

    // ?count=1 → load ALL rows and count them
    if (req.nextUrl.searchParams.get("count") === "1") {
      const rows = await erpFetchAll<{ is_active?: string; is_sys_data?: string }>(`rx-data/${name}`, s.erpToken, { user_id: s.userId });
      return NextResponse.json({
        path: name,
        total: rows.length,
        active: rows.filter((r) => (r.is_active ?? "Y") === "Y").length,
        inactive: rows.filter((r) => r.is_active === "N").length,
        system: rows.filter((r) => r.is_sys_data === "Y").length,
        addedByDoctors: rows.filter((r) => r.is_sys_data === "N").length,
      });
    }

    const data = await erpFetch<{ items?: unknown[]; hasMore?: boolean }>(`rx-data/${name}`, {
      token: s.erpToken,
      query: { user_id: s.userId, offset: 0, limit: 3 },
    });
    return NextResponse.json({ path: name, hasMore: data?.hasMore, sample: data?.items?.slice(0, 3) ?? data });
  });
}