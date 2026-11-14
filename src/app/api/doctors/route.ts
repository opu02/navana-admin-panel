import { NextResponse } from "next/server";
import type { Doctor } from "@/lib/types";
import { MOCK_DOCTORS } from "@/lib/mock-data";

// GET /api/doctors → list for the "Doctor" filter
export async function GET() {
  if (process.env.MOCK_DATA === "true") {
    return NextResponse.json(MOCK_DOCTORS);
  }
  // TODO (Step 10): GET `${process.env.API_URL}/api/doctors`
  const doctors: Doctor[] = [];
  return NextResponse.json(doctors);
}
