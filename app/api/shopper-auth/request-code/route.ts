import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's shopper-auth API (BSA Phase 19) —
// same reasoning as app/api/booking/widget-config/route.ts. No cookie
// involved on this one request (the code hasn't been verified yet), so
// unlike verify-code/session/logout below, nothing needs forwarding beyond
// body+status.
const SHOPPER_AUTH_BASE = "https://mcp.vibemeasite.com/api/shopper-auth/";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    const res = await fetch(`${SHOPPER_AUTH_BASE}request-code`, {
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
