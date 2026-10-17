import { NextRequest, NextResponse } from "next/server";
import { getSiteSettings } from "../../../../../lib/queries";

// BSA Phase 27 (slice 5, US-VMAS-TRAVEL-16) — same-origin relay for the trip
// wall to vibemeasite-mcp's /api/public-trips/{action}. Forwards this site's
// Phase 19 session cookie (the control plane checks the roster) and adds the
// site's own shopAuthPublicId itself, so the browser never chooses the site.
//   POST upload?trip=<slug>   raw image bytes → { url, sig }
//   POST post | edit | delete JSON (see the control-plane handler)

export const dynamic = "force-dynamic";

const BASE = "https://mcp.vibemeasite.com/api/public-trips/";
const ACTIONS = new Set(["upload", "post", "edit", "delete"]);
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SESSION_COOKIE = "vms_shop_session";
const MAX_UPLOAD = 4 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  const settings = await getSiteSettings();
  const pid = (settings as { visitorAuthPublicId?: string | null }).visitorAuthPublicId;
  if (!pid) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return NextResponse.json({ ok: false, code: "signed_out", message: "Sign in to this trip again." }, { status: 401 });
  const headers: Record<string, string> = { cookie: `${SESSION_COOKIE}=${session}` };

  let url = `${BASE}${action}`;
  let body: BodyInit;
  if (action === "upload") {
    const trip = req.nextUrl.searchParams.get("trip") ?? "";
    if (!SLUG.test(trip)) return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0) return NextResponse.json({ ok: false, message: "No photo received." }, { status: 400 });
    if (buf.byteLength > MAX_UPLOAD) return NextResponse.json({ ok: false, code: "too_big", message: "This photo is too large." }, { status: 413 });
    url += `?pid=${encodeURIComponent(pid)}&trip=${encodeURIComponent(trip)}`;
    headers["Content-Type"] = "application/octet-stream";
    body = buf;
  } else {
    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
    }
    json.pid = pid;
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  try {
    const upstream = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(55000) });
    const out = await upstream.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }));
    return NextResponse.json(out, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 502 });
  }
}
