import { NextRequest, NextResponse } from "next/server";

// See app/api/booking/widget-config/route.ts for why this relay exists.
const PUBLIC_BOOKING_BASE = "https://mcp.vibemeasite.com/api/public-booking/";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;

  try {
    const res = await fetch(`${PUBLIC_BOOKING_BASE}availability?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
