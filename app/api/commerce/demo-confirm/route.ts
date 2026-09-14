import { NextRequest, NextResponse } from "next/server";

// Same-origin relay for the demo-checkout confirm page's "Confirm demo
// purchase" button (BSA Phase 20 Decided #1's interim note — the demo
// provider's stand-in for a real Stripe webhook). Forwards the session
// cookie so the resulting order is tied to the logged-in shopper.
const PUBLIC_COMMERCE_BASE = "https://mcp.vibemeasite.com/api/public-commerce/";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    const cookie = req.headers.get("cookie") ?? "";
    const upstream = await fetch(`${PUBLIC_COMMERCE_BASE}demo-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    const json = await upstream.json().catch(() => ({}));
    return NextResponse.json(json, { status: upstream.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
