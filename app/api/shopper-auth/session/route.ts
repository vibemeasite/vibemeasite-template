import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's shopper-auth API (BSA Phase 19).
// Forwards this site's own session cookie upstream so getSessionShopper can
// look it up — nothing to forward back (the session id itself never
// changes on a refresh, only its expiry in the control-plane DB), unlike
// verify-code/route.ts which does need to forward Set-Cookie.
const SHOPPER_AUTH_BASE = "https://mcp.vibemeasite.com/api/shopper-auth/";

export async function GET(req: NextRequest) {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const res = await fetch(`${SHOPPER_AUTH_BASE}session`, {
      headers: cookie ? { cookie } : {},
    });
    const json = await res.json().catch(() => ({ loggedIn: false }));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ loggedIn: false }, { status: 502 });
  }
}
