import { unstable_cache } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index";
import { places, placeTranslations, trips, tripTranslations, tripStops } from "../db/schema";

// BSA Phase 27 — Travel Kit reads. Every read is cached under the single
// "trips" tag, which vibemeasite-mcp revalidates after any place/trip/stop
// write. Status (upcoming/past) is NOT cached — it's computed per request from
// these dates (lib/travel-text.ts tripStatus), since the route is dynamic.
//
// Dates come back as ISO strings: unstable_cache JSON-serializes its result,
// so a Date would silently turn into a string anyway on a cache hit.

export interface TripText {
  title: string;
  summary: string;
}

export interface CalendarTrip {
  slug: string;
  pageSlug: string;
  startAt: string;
  endAt: string;
  timezone: string;
  coverImage: string | null;
  bookUrl: string | null;
  cancelledAt: string | null;
  text: Record<string, TripText>;
}

export interface TripStopView {
  position: number;
  arriveAt: string | null;
  durationMin: number | null;
  mapX: number | null;
  mapY: number | null;
  revealRadiusM: number;
  note: Record<string, string>;
  place: {
    slug: string;
    lat: number;
    lng: number;
    address: string | null;
    images: Array<{ url: string; alt?: string }>;
    text: Record<string, { title: string; summary: string; history: string }>;
  };
}

export interface TripView extends CalendarTrip {
  cancelReason: string | null;
  accessFrom: string | null;
  accessUntil: string | null;
  postTripVisibility: "public" | "participants";
  stops: TripStopView[];
}

const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);

async function tripTexts(ids: string[]): Promise<Map<string, Record<string, TripText>>> {
  const out = new Map<string, Record<string, TripText>>();
  if (!ids.length) return out;
  const rows = await db.select().from(tripTranslations).where(inArray(tripTranslations.tripId, ids));
  for (const r of rows) {
    const m = out.get(r.tripId) ?? {};
    m[r.lang] = { title: r.title, summary: r.summary };
    out.set(r.tripId, m);
  }
  return out;
}

export const getCalendarTrips = unstable_cache(
  async (): Promise<CalendarTrip[]> => {
    const rows = await db.select().from(trips).orderBy(asc(trips.startAt));
    const texts = await tripTexts(rows.map((r) => r.id));
    return rows.map((r) => ({
      slug: r.slug,
      pageSlug: r.pageSlug,
      startAt: iso(r.startAt)!,
      endAt: iso(r.endAt)!,
      timezone: r.timezone,
      coverImage: r.coverImage,
      bookUrl: r.bookUrl,
      cancelledAt: iso(r.cancelledAt),
      text: texts.get(r.id) ?? {},
    }));
  },
  ["travel-calendar-trips"],
  { tags: ["trips"] },
);

export function getTripForPage(pageSlug: string): Promise<TripView | null> {
  return unstable_cache(
    async (): Promise<TripView | null> => {
      const [trip] = await db.select().from(trips).where(eq(trips.pageSlug, pageSlug)).limit(1);
      if (!trip) return null;
      const texts = await tripTexts([trip.id]);
      const stopRows = await db
        .select({ stop: tripStops, place: places })
        .from(tripStops)
        .innerJoin(places, eq(tripStops.placeId, places.id))
        .where(eq(tripStops.tripId, trip.id))
        .orderBy(asc(tripStops.position));
      const placeIds = [...new Set(stopRows.map((r) => r.place.id))];
      const placeText = new Map<string, Record<string, { title: string; summary: string; history: string }>>();
      if (placeIds.length) {
        const rows = await db.select().from(placeTranslations).where(inArray(placeTranslations.placeId, placeIds));
        for (const r of rows) {
          const m = placeText.get(r.placeId) ?? {};
          m[r.lang] = { title: r.title, summary: r.summary, history: r.history };
          placeText.set(r.placeId, m);
        }
      }
      return {
        slug: trip.slug,
        pageSlug: trip.pageSlug,
        startAt: iso(trip.startAt)!,
        endAt: iso(trip.endAt)!,
        timezone: trip.timezone,
        coverImage: trip.coverImage,
        bookUrl: trip.bookUrl,
        cancelledAt: iso(trip.cancelledAt),
        cancelReason: trip.cancelReason,
        accessFrom: iso(trip.accessFrom),
        accessUntil: iso(trip.accessUntil),
        postTripVisibility: trip.postTripVisibility === "participants" ? "participants" : "public",
        text: texts.get(trip.id) ?? {},
        stops: stopRows.map(({ stop, place }) => ({
          position: stop.position,
          arriveAt: iso(stop.arriveAt),
          durationMin: stop.durationMin,
          mapX: stop.mapX,
          mapY: stop.mapY,
          revealRadiusM: stop.revealRadiusM ?? 300,
          note: (stop.noteJson as Record<string, string> | null) ?? {},
          place: {
            slug: place.slug,
            lat: place.lat,
            lng: place.lng,
            address: place.address,
            images: (place.images as Array<{ url: string; alt?: string }> | null) ?? [],
            text: placeText.get(place.id) ?? {},
          },
        })),
      };
    },
    ["travel-trip-page", pageSlug],
    { tags: ["trips", `page-${pageSlug}`] },
  )();
}
