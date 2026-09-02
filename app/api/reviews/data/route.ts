import { NextRequest, NextResponse } from "next/server";

// Same-origin relay to vibemeasite-mcp's public reviews endpoint (a `case`
// in the consolidated public-booking handler) — purely to avoid the
// cross-origin/CORS class of bug this template's forms.js already hit once
// (see app/api/forms/submit/[slug]/route.ts). No secret needed:
// widget_public_id alone scopes the request, same as the booking relays.
const UPSTREAM = "https://mcp.vibemeasite.com/api/public-booking/reviews-data";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const widget = params.get("widget") ?? "";
  const lang = params.get("lang");

  try {
    const url = `${UPSTREAM}?widget=${encodeURIComponent(widget)}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const json = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
