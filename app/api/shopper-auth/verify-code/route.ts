import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's shopper-auth API (BSA Phase 19).
// The one relay in this template that must forward Set-Cookie — for the
// session cookie to land on THIS site's own custom domain (ADR-001 §3),
// the shopper's browser has to receive it from this same-origin response,
// not from a cross-origin mcp.vibemeasite.com response. Every other relay
// in this app (booking, forms, etc.) only proxies body+status because none
// of them sets a cookie.
const SHOPPER_AUTH_BASE = "https://mcp.vibemeasite.com/api/shopper-auth/";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  // Forwards this browser's anonymous cart_token cookie (if any) alongside
  // the verify-code body so vibemeasite-mcp can merge it into the shopper's
  // account cart on successful login (US-VMAS-CART-01 AC3) — the control
  // plane never reads this template's cookies directly, only what's handed
  // to it here.
  const cartToken = req.cookies.get("vms_cart_token")?.value;
  if (cartToken) body.cartToken = cartToken;

  try {
    const upstream = await fetch(`${SHOPPER_AUTH_BASE}verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
