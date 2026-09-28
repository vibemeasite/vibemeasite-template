import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public carousel API — same
// reasoning as app/api/booking/widget-config/route.ts (avoids the
// cross-origin/CORS class of bug forms.js hit once). No secret needed:
// carousel_public_id alone scopes the request either way.
const PUBLIC_CAROUSEL_BASE = "https://mcp.vibemeasite.com/api/public-carousel/";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const carousel = params.get("carousel") ?? "";
  const lang = params.get("lang");

  try {
    const upstream = `${PUBLIC_CAROUSEL_BASE}slides?carousel=${encodeURIComponent(carousel)}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;
    const res = await fetch(upstream);
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
