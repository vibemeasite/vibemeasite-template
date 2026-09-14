import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public commerce API (BSA Phase
// 20). Must forward both directions: the incoming Cookie header (so the
// control plane can resolve the shopper's session or anonymous cart_token)
// and any Set-Cookie it sends back (a first-time visitor gets a new
// cart_token minted here) — same pattern as the shopper-auth relays.
const PUBLIC_COMMERCE_BASE = "https://mcp.vibemeasite.com/api/public-commerce/";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const upstream = await fetch(`${PUBLIC_COMMERCE_BASE}cart?${params.toString()}`, {
      headers: cookie ? { cookie } : {},
    });
    const json = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(json, { status: upstream.status });

    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
