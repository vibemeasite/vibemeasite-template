import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../../../../db/index";
import { getSiteSettings } from "../../../../lib/queries";
import { getTripViewer } from "../../../../lib/trip-session";
import { tripAudioSrc, tripPagePath } from "../../../../lib/trip-offline";

// BSA Phase 27 (slice 3, US-VMAS-TRAVEL-13) — what a participant's phone must
// store to use this trip offline. Participants only.
// GET /api/trips/offline-manifest?trip=<tripSlug>
//
// Lists the trip page in every site locale and every recording of every stop
// in every language. public/trip.js adds the page's own scripts/styles/photos
// by reading each fetched page. `version` changes whenever anything in the
// bundle can change — the trip, its places, its audio, or the site's code
// (deployment) — so a downloaded copy knows when to offer an update.

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function GET(req: NextRequest) {
  const trip = req.nextUrl.searchParams.get("trip") ?? "";
  if (!SLUG.test(trip)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const settings = await getSiteSettings();
  const viewer = await getTripViewer((settings as { visitorAuthPublicId?: string | null }).visitorAuthPublicId, trip);
  if (!viewer.participant) return NextResponse.json({ error: "Participants only" }, { status: 403 });

  const tripRow = (await db.execute(sql`
    select id, slug, page_slug, updated_at, access_until, end_at from trips where slug = ${trip} limit 1
  `)) as unknown as { rows: Array<{ id: string; slug: string; page_slug: string; updated_at: string; access_until: string | null; end_at: string }> };
  const t = tripRow.rows[0];
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const placeRows = (await db.execute(sql`
    select distinct p.slug, p.updated_at from trip_stops s join places p on p.id = s.place_id where s.trip_id = ${t.id} order by p.slug
  `)) as unknown as { rows: Array<{ slug: string; updated_at: string }> };
  const audioRows = (await db
    .execute(sql`
      select p.slug as place, a.lang, a.bytes, a.sha256
      from place_audio a join places p on p.id = a.place_id
      where a.place_id in (select place_id from trip_stops where trip_id = ${t.id})
      order by p.slug, a.lang
    `)
    .catch(() => ({ rows: [] }))) as unknown as { rows: Array<{ place: string; lang: string; bytes: number; sha256: string }> };

  const defaultLocale = settings.defaultLocale;
  const locales = [defaultLocale, ...((settings.availableLocales as string[] | null) ?? []).filter((l) => l !== defaultLocale)];
  const pages = locales.map((l) => tripPagePath(t.page_slug, l, defaultLocale));
  const audio = audioRows.rows.map((a) => ({
    url: tripAudioSrc(t.slug, a.place, a.lang, a.sha256.slice(0, 12)),
    bytes: Number(a.bytes),
    lang: a.lang,
  }));

  const version = createHash("sha256")
    .update(
      JSON.stringify({
        trip: t.updated_at,
        places: placeRows.rows.map((p) => [p.slug, p.updated_at]),
        audio: audioRows.rows.map((a) => a.sha256),
        locales,
        build: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
      }),
    )
    .digest("hex")
    .slice(0, 16);

  return NextResponse.json(
    {
      trip: t.slug,
      version,
      accessUntil: t.access_until ? new Date(t.access_until).toISOString() : new Date(Date.parse(t.end_at) + 30 * 86_400_000).toISOString(),
      pages,
      audio,
      audioBytes: audio.reduce((n, a) => n + a.bytes, 0),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
