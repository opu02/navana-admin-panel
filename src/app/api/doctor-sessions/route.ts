import { NextResponse, type NextRequest } from "next/server";
import {
  EMPTY_SESSION_STATS, type DoctorSessionListResponse, type PrescriptionFilters,
} from "@/lib/types";
import { getMockSessions } from "@/lib/mock-data";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/doctor-sessions?doctorId=&from=&to=&search=&page=1&pageSize=10
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
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
    return NextResponse.json(getMockSessions(filters, page, pageSize));
  }

  // TODO (Step 10): GET `${process.env.API_URL}/api/doctor-sessions?...`
  const empty: DoctorSessionListResponse = { items: [], total: 0, page, pageSize, stats: EMPTY_SESSION_STATS };
  return NextResponse.json(empty);
}
