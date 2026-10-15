import { cookies } from "next/headers";

// BSA Phase 27 (slice 2) — is the visitor rendering this trip page a
// participant of the trip? The answer lives in the control plane (roster +
// Phase 19 sessions), so the server render forwards this site's own session
// cookie there. No cookie → no request. Any failure → "not a participant"
// (the page degrades to the public preview, never to an error).

const TRIP_ACCESS_URL = "https://mcp.vibemeasite.com/api/shopper-auth/trip-access";
const SESSION_COOKIE = "vms_shop_session";

export type TripViewer = { participant: false } | { participant: true; email: string; name: string | null };

export async function getTripViewer(publicId: string | null | undefined, tripSlug: string): Promise<TripViewer> {
  if (!publicId) return { participant: false };
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return { participant: false };
  try {
    const res = await fetch(`${TRIP_ACCESS_URL}?pid=${encodeURIComponent(publicId)}&trip=${encodeURIComponent(tripSlug)}`, {
      headers: { cookie: `${SESSION_COOKIE}=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { participant: false };
    const data = (await res.json()) as { participant?: boolean; email?: string; name?: string | null };
    return data.participant && data.email ? { participant: true, email: data.email, name: data.name ?? null } : { participant: false };
  } catch {
    return { participant: false };
  }
}

export { timeRevealedUpTo } from "./travel-text";
