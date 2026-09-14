import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public commerce API — public,
// same as products/route.ts.
const PUBLIC_COMMERCE_BASE = "https://mcp.vibemeasite.com/api/public-commerce/";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  try {
    const res = await fetch(`${PUBLIC_COMMERCE_BASE}product?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
