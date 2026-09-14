import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public commerce API. Forwards the
// incoming session cookie so checkout can be tied to the logged-in
// shopper — see app/api/commerce/cart/route.ts for the cookie-forwarding
// rationale. Also fills in siteBaseUrl (the control plane needs this site's
// own origin to build success/cancel URLs and, for the demo provider, the
// confirm-page URL) from the incoming request rather than trusting a
// client-supplied value.
const PUBLIC_COMMERCE_BASE = "https://mcp.vibemeasite.com/api/public-commerce/";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  body.siteBaseUrl = new URL(req.url).origin;

  try {
    const cookie = req.headers.get("cookie") ?? "";
    const upstream = await fetch(`${PUBLIC_COMMERCE_BASE}checkout`, {
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
