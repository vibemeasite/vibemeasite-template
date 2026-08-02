import { NextRequest, NextResponse } from "next/server";

// See app/api/booking/widget-config/route.ts for why this relay exists.
const PUBLIC_BOOKING_BASE = "https://mcp.vibemeasite.com/api/public-booking/";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    const res = await fetch(`${PUBLIC_BOOKING_BASE}confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
