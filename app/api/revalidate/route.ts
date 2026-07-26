import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

// Called by vibemeasite-mcp after a Postgres write (US-VMAS-MUTATE-01) — set
// by vibemeasite-mcp on the Vercel project at provisioning time
// (US-VMAS-DEPLOY-04). Only covers menu/page/settings tags; container/block
// content uses time-based ISR instead (see lib/cellpy-block.ts) and needs
// no revalidate call per edit.
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
    // Next.js 16 requires a second "profile" argument — "max" is what
    // Next's own deprecation message recommends as the equivalent of the
    // old single-argument (immediate, on-demand) behavior. `updateTag()`
    // is the newer alternative but only works inside Server Actions, not
    // Route Handlers like this one.
    revalidateTag(tag, "max");
  }

  return NextResponse.json({ revalidated: true, tags });
}
