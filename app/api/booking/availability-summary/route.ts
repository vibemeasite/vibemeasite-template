import { NextRequest, NextResponse } from "next/server";

// See app/api/booking/widget-config/route.ts for why this relay exists.
// Calendar View — month-level has-availability-per-day flags for painting
// the calendar grid's dots, backed by the shared mcp.vibemeasite.com
// availability-summary action (see booking-service.ts's getMonthAvailability).
const PUBLIC_BOOKING_BASE = "https://mcp.vibemeasite.com/api/public-booking/";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;

  try {
    const res = await fetch(`${PUBLIC_BOOKING_BASE}availability-summary?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
