import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public booking API — purely to
// avoid the cross-origin/CORS class of bug this template's forms.js
// already hit once and moved away from (see
// app/api/forms/submit/[slug]/route.ts's own comment). No secret is
// needed here: widget_public_id alone scopes every request below, the
// same whether it's relayed same-origin or made directly cross-origin.
const PUBLIC_BOOKING_BASE = "https://mcp.vibemeasite.com/api/public-booking/";

export async function GET(req: NextRequest) {
  const widget = new URL(req.url).searchParams.get("widget") ?? "";

  try {
    const res = await fetch(`${PUBLIC_BOOKING_BASE}widget-config?widget=${encodeURIComponent(widget)}`);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
