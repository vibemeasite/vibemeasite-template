// BSA Phase 22 — pure blog rendering helpers: no DB, no React. Mirrors
// vibemeasite-mcp's lib/blog-format.ts (a different repo/deploy) for the
// one rule that must not drift between them: isPublished.

// BSA Phase 22 amendment — the blog index's optional search/tag/category
// filter widget config, mirrored from vibemeasite-mcp's
// site_settings.blog_filter_config (see lib/queries.ts's getSiteSettings).
// categoriesStyle/tagsStyle are a later same-amendment addition — a stored
// config from before they existed has neither key, so every reader treats
// a missing value as "dropdown" (see BlogFilterWidget's own default).
export interface BlogFilterConfig {
  enabled: boolean;
  showSearch: boolean;
  showCategories: boolean;
  showTags: boolean;
  categoriesStyle?: "dropdown" | "chips";
  tagsStyle?: "dropdown" | "chips";
}

// BSA Phase 22 amendment (LLM-customizable blog card/grid) — the blog
// card/grid's visual knobs, mirrored from vibemeasite-mcp's
// site_settings.blog_style_config (see lib/queries.ts's getSiteSettings).
// This exists because generate_block can't reach card/grid markup at
// all — it's server-rendered straight from live post data on every
// request (BlogPostCard/BlogPostGrid), not a static Cellpy-block section —
// so set_blog_style is the only way an owner (or the LLM on their behalf)
// customizes how it looks.
export interface BlogStyleConfig {
  columns: "auto" | 2 | 3 | 4;
  cardStyle: "bordered" | "flat" | "shadow";
  showImage: boolean;
  borderRadius: number;
  // null means "inherit the site's branding primary color" — resolved at
  // render time via a CSS var() fallback, not stored/computed here.
  accentColor: string | null;
  spacing: "compact" | "normal" | "relaxed";
}

export const DEFAULT_BLOG_STYLE_CONFIG: BlogStyleConfig = {
  columns: "auto",
  cardStyle: "bordered",
  showImage: true,
  borderRadius: 12,
  accentColor: null,
  spacing: "normal",
};

const BLOG_SPACING_VALUES: Record<BlogStyleConfig["spacing"], { gap: number; padding: number }> = {
  compact: { gap: 10, padding: 12 },
  normal: { gap: 16, padding: 18 },
  relaxed: { gap: 24, padding: 24 },
};

// Renders a BlogStyleConfig as CSS custom properties, applied once on the
// grid wrapper (BlogPostGrid) so .blog-card/.blog-chip/.blog-more in
// app/globals.css just var()-read them — no need to thread individual
// style values through every component's props.
export function blogStyleVars(config: BlogStyleConfig): Record<string, string> {
  const { gap, padding } = BLOG_SPACING_VALUES[config.spacing] ?? BLOG_SPACING_VALUES.normal;
  const gridTemplate =
    config.columns === "auto" || !config.columns
      ? "repeat(auto-fill, minmax(280px, 1fr))"
      : `repeat(${config.columns}, 1fr)`;
  const border =
    config.cardStyle === "bordered"
      ? "1px solid color-mix(in srgb, var(--color-text, #888) 14%, transparent)"
      : "none";
  const shadow =
    config.cardStyle === "shadow"
      ? "0 4px 16px color-mix(in srgb, var(--color-text, #888) 16%, transparent)"
      : "none";
  const vars: Record<string, string> = {
    "--blog-grid-template": gridTemplate,
    "--blog-gap": `${gap}px`,
    "--blog-card-padding": `${padding}px`,
    "--blog-card-radius": `${config.borderRadius ?? 12}px`,
    "--blog-card-border": border,
    "--blog-card-shadow": shadow,
  };
  if (config.accentColor) vars["--blog-accent"] = config.accentColor;
  return vars;
}

type BlogSearchParams = Record<string, string | string[] | undefined>;

// Multi-valued-param-safe query-string builder — lib/entries-query.ts's
// withParams (Phase 16) only ever keeps the FIRST value of an array-valued
// param, which silently drops every tag/category past the first when the
// chips widget selects several ("Show more" would lose them). Used for
// every blog pagination link once more than one tag/category can be
// selected at once.
export function buildBlogQueryString(sp: BlogSearchParams, overrides: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in overrides) continue; // overrides replace this key entirely, applied below
    if (Array.isArray(v)) {
      for (const item of v) if (item) params.append(k, item);
    } else if (v) {
      params.append(k, v);
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
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
