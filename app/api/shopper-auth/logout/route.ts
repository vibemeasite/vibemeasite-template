import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's shopper-auth API (BSA Phase 19).
// Forwards the incoming session cookie upstream (so the right session row
// is deleted) and forwards the upstream's cookie-clearing Set-Cookie back —
// same forwarding need as verify-code/route.ts, opposite direction.
const SHOPPER_AUTH_BASE = "https://mcp.vibemeasite.com/api/shopper-auth/";

export async function POST(req: NextRequest) {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const upstream = await fetch(`${SHOPPER_AUTH_BASE}logout`, {
      method: "POST",
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
