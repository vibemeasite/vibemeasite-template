import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

// Called by vibemeasite-mcp after a Postgres write (US-VMAS-MUTATE-01) — set
// by vibemeasite-mcp on the Vercel project at provisioning time
// (US-VMAS-DEPLOY-04). Also called after every block publish, tagged
// `container-{slug}` (see lib/cellpy-block.ts) — the passive 30s ISR poll
// alone was found to wedge indefinitely if a background revalidation fetch
// ever errored, so publish now actively busts the specific container's tag
// instead of only relying on it.
export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const auth = req.headers.get("authorization");

  if (!expected || !auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provided = Buffer.from(auth.slice(7));
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tags } = (await req.json()) as { tags?: string[] };
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: "tags array is required" }, { status: 400 });
  }

  for (const tag of tags) {
    // NOT revalidateTag(tag, "max") — "max" is a cacheLife *retention*
    // profile (longest-lived), and Next's own revalidate() only marks the
    // route's static/Full Route Cache entry as revalidated when the
    // resolved profile's `expire` is 0 (see
    // next/dist/server/web/spec-extension/revalidate.js). "max" doesn't
    // satisfy that, so it updates the pending-tag list but never actually
    // busts the previously rendered page — confirmed by calling this
    // route directly against a live deployment and seeing stale content
    // persist. `{ expire: 0 }` is an explicit CacheLifeConfig requesting
    // immediate invalidation — the correct typed equivalent of the old
    // single-argument (deprecated) call. `updateTag()` is the other
    // official alternative but only works inside Server Actions, not
    // Route Handlers like this one.
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ revalidated: true, tags });
}
