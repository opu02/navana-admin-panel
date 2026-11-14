import { NextResponse, type NextRequest } from "next/server";
import { EMPTY_STATS, type PrescriptionFilters, type PrescriptionListResponse } from "@/lib/types";
import { getMockPrescriptions } from "@/lib/mock-data";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/prescriptions?doctorId=&from=&to=&search=&page=1&pageSize=10
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Clean and limit every input (never trust the browser)
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(sp.get("pageSize")) || 10)));
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const filters: PrescriptionFilters = {
    doctorId: sp.get("doctorId")?.slice(0, 64) || undefined,
    from: DATE.test(from) ? from : undefined,
    to: DATE.test(to) ? to : undefined,
    search: sp.get("search")?.trim().slice(0, 100) || undefined,
  };

  if (process.env.MOCK_DATA === "true") {
    return NextResponse.json(getMockPrescriptions(filters, page, pageSize));
  }

  // TODO (Step 10): forward this request to the ASP.NET Core API, e.g.
  // GET `${process.env.API_URL}/api/prescriptions?...` with the user's token.
  const empty: PrescriptionListResponse = { items: [], total: 0, page, pageSize, stats: EMPTY_STATS };
  return NextResponse.json(empty);
}
