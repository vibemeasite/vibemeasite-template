import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public commerce API — see
// app/api/commerce/cart/route.ts for why both cookie directions matter.
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
    const upstream = await fetch(`${PUBLIC_COMMERCE_BASE}cart-add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
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
