import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../../db/index";
import { getSiteSettings } from "../../../../lib/queries";
import { getTripViewer } from "../../../../lib/trip-session";

// BSA Phase 27 — audio-guide streaming, participants only (P6/P9).
// GET /api/trips/audio?trip=<tripSlug>&place=<placeSlug>&lang=<lang>
//
// INTERIM storage: place_audio.data (bytea) in this site's own DB. Each
// request checks the visitor's Phase 19 session against the trip roster via
// the control plane (lib/trip-session.ts), checks the place is actually a
// stop of that trip, then serves the bytes — with HTTP Range / 206 so <audio>
// can seek (BSA P14). Only the requested byte window is read from Postgres
// (substring on the bytea), never the whole file per seek.
//
// Never cached by shared caches (private). The offline trip bundle (later
// slice) fetches through this same route.

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const LANG = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i;
const MAX_CHUNK = 2 * 1024 * 1024; // cap an open-ended range at 2 MB per response

export async function GET(req: NextRequest) {
  const trip = req.nextUrl.searchParams.get("trip") ?? "";
  const place = req.nextUrl.searchParams.get("place") ?? "";
  const lang = req.nextUrl.searchParams.get("lang") ?? "";
  if (!SLUG.test(trip) || !SLUG.test(place) || !LANG.test(lang)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const settings = await getSiteSettings();
  const viewer = await getTripViewer((settings as { visitorAuthPublicId?: string | null }).visitorAuthPublicId, trip);
  if (!viewer.participant) return NextResponse.json({ error: "Participants only" }, { status: 403 });

  const meta = (await db.execute(sql`
    select a.id, a.mime, a.bytes, a.sha256
    from place_audio a
    join places p on p.id = a.place_id
    join trip_stops s on s.place_id = p.id
    join trips t on t.id = s.trip_id
    where t.slug = ${trip} and p.slug = ${place} and a.lang = ${lang}
    limit 1
  `)) as unknown as { rows: Array<{ id: string; mime: string; bytes: number; sha256: string }> };
  const row = meta.rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = Number(row.bytes);
  const etag = `"${row.sha256.slice(0, 32)}"`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": row.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: baseHeaders });

  let start = 0;
  let end = total - 1;
  let partial = false;
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new NextResponse(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${total}` } });
    }
    if (m[1] === "") {
      // Suffix range: the last N bytes.
      start = Math.max(0, total - Number(m[2]));
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? Math.min(total - 1, start + MAX_CHUNK - 1) : Math.min(total - 1, Number(m[2]));
    }
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${total}` } });
    }
    partial = true;
  }

  const length = end - start + 1;
  const chunk = (await db.execute(sql`
    select substring(data from ${start + 1} for ${length}) as part from place_audio where id = ${row.id}
  `)) as unknown as { rows: Array<{ part: unknown }> };
  const bytes = toBuffer(chunk.rows[0]?.part);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    status: partial ? 206 : 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(bytes.length),
      ...(partial ? { "Content-Range": `bytes ${start}-${start + bytes.length - 1}/${total}` } : {}),
    },
  });
}

// neon-http returns bytea as a "\x..." hex string; a TCP driver as a Buffer.
function toBuffer(v: unknown): Buffer | null {
  if (!v) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string") return Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex");
  return null;
}
