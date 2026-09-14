import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public carousel API — same
// reasoning as app/api/booking/widget-config/route.ts (avoids the
// cross-origin/CORS class of bug forms.js hit once). No secret needed:
// carousel_public_id alone scopes the request either way.
const PUBLIC_CAROUSEL_BASE = "https://mcp.vibemeasite.com/api/public-carousel/";

export async function GET(req: NextRequest) {
  const carousel = new URL(req.url).searchParams.get("carousel") ?? "";

  try {
    const res = await fetch(`${PUBLIC_CAROUSEL_BASE}slides?carousel=${encodeURIComponent(carousel)}`);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
