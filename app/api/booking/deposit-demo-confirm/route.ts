import { NextRequest, NextResponse } from "next/server";

// Same-origin relay for the booking-deposit demo-checkout page's "Confirm"
// button (BSA Phase 23) — the demo provider's stand-in for a real Square
// webhook, same reasoning as app/api/commerce/demo-confirm/route.ts.
const PUBLIC_BOOKING_BASE = "https://mcp.vibemeasite.com/api/public-booking/";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${PUBLIC_BOOKING_BASE}deposit-demo-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await upstream.json().catch(() => ({}));
    return NextResponse.json(json, { status: upstream.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
