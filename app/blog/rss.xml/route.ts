import { headers } from "next/headers";
import { getPublishedPosts, getBlogTags } from "../../../lib/blog-query";
import { getSiteSettings } from "../../../lib/queries";
import { buildRssXml } from "../../../lib/blog-render";

// BSA Phase 22 (US-VMAS-BLOG-07) — one global, default-language-only RSS
// feed, capped at 50 items. A literal static path — Next's router matches
// it ahead of the app/[[...path]] catch-all with zero collision risk, same
// precedence app/api/* and app/demo-checkout/* already rely on, so this
// needs no dispatch wiring there. force-dynamic for the same reason the
// catch-all itself is: this must reflect isPublished()'s time-of-request
// gate (a scheduled post appearing the moment its publish time passes), not
// a stale prerendered response.
export const dynamic = "force-dynamic";

export async function GET() {
  const [{ rows }, settings, tagRows, headersList] = await Promise.all([
    getPublishedPosts({ page: 1, pageSize: 50 }),
    getSiteSettings(),
    getBlogTags(),
    headers(),
  ]);
  const baseUrl = `https://${headersList.get("host")}`;
  const siteName = settings.siteName || "Blog";
  const tagNames = Object.fromEntries(tagRows.map((t) => [t.slug, t.name]));

  const xml = buildRssXml({
    siteName,
    baseUrl,
    posts: rows.map((p) => ({
      title: p.title,
      url: `${baseUrl}/blog/${p.postSlug}`,
      publishedAt: p.post.publishedAt ?? new Date().toISOString(),
      description: p.post.excerpt ?? "",
      // RSS <category> elements should read as real words (WordPress puts
      // the tag's display NAME here, not its slug) — resolve via the tag
      // registry, same as every other tag chip in the app.
      tags: (p.post.tags ?? []).map((slug) => tagNames[slug] ?? slug),
    })),
  });

  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
