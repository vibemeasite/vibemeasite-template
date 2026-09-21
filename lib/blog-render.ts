// BSA Phase 22 — pure blog rendering helpers: no DB, no React. Mirrors
// vibemeasite-mcp's lib/blog-format.ts (a different repo/deploy) for the
// one rule that must not drift between them: isPublished.

// BSA Phase 22 amendment — the blog index's optional search/tag/category
// filter widget config, mirrored from vibemeasite-mcp's
// site_settings.blog_filter_config (see lib/queries.ts's getSiteSettings).
export interface BlogFilterConfig {
  enabled: boolean;
  showSearch: boolean;
  showCategories: boolean;
  showTags: boolean;
}

export interface PostMeta {
  // Tag SLUGS (Phase 22 amendment — resolved to display names via
  // lib/blog-query.ts's getBlogTags, same as categories below), not raw
  // display text.
  tags?: string[];
  categories?: string[];
  excerpt?: string;
  featuredImage?: string;
  publishedAt?: string | null;
  status: "draft" | "scheduled" | "published";
  author?: string;
}

// The SINGLE rule gating every listing/archive/sitemap/RSS/noindex
// decision. `status` is a convenience/cache field only — this is what
// actually decides visibility (BSA Phase 22 Decided #5). Keep byte-for-byte
// in sync with vibemeasite-mcp/lib/blog-format.ts's copy by hand.
export function isPublished(post: Pick<PostMeta, "status" | "publishedAt"> | null | undefined): boolean {
  if (!post) return false;
  if (post.status === "draft") return false;
  if (!post.publishedAt) return false;
  const t = new Date(post.publishedAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

const HTML_TAG_RE = /<[^>]*>/g;
const WHITESPACE_RE = /\s+/g;

// Strips tags from a section's raw HTML and truncates to a word boundary —
// used as the excerpt fallback (index/archive cards, RSS description) when
// the post has no explicit `excerpt` set.
export function plainTextExcerpt(html: string, maxLength = 200): string {
  const text = html.replace(HTML_TAG_RE, " ").replace(WHITESPACE_RE, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export function postExcerpt(post: Pick<PostMeta, "excerpt">, firstSectionHtml?: string): string {
  if (post.excerpt) return post.excerpt;
  if (firstSectionHtml) return plainTextExcerpt(firstSectionHtml);
  return "";
}

export function formatPostDate(publishedAt: string | null | undefined, locale = "en-US"): string {
  if (!publishedAt) return "";
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface RssPost {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  tags: string[];
}

export function buildRssXml(opts: { siteName: string; baseUrl: string; posts: RssPost[] }): string {
  const { siteName, baseUrl, posts } = opts;
  const feedUrl = `${baseUrl}/blog/rss.xml`;
  const items = posts
    .map((p) => {
      const categories = p.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join("\n");
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${escapeXml(p.url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(p.url)}</guid>`,
        `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
        p.description ? `      <description>${escapeXml(p.description)}</description>` : "",
        categories,
        "    </item>",
      ].filter(Boolean).join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${escapeXml(baseUrl)}/blog</link>`,
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(siteName)} blog</description>`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
