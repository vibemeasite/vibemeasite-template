import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAllPages, getSiteSettings } from "../lib/queries";
import { getAllBlogPostPages, getBlogCategories } from "../lib/blog-query";
import { isPublished, type PostMeta } from "../lib/blog-render";

// No reliable domain env var exists in this template (each site is its own
// Vercel project, and custom domains vs. the default vercel.app URL both
// need to work) — building the base URL from the incoming request's own
// Host header, same as any other per-deployment absolute URL here, avoids
// needing one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;

  const [pages, settings] = await Promise.all([getAllPages(), getSiteSettings()]);
  const isOnePage = settings.layoutMode === "one-page";
  const availableLocales = (settings.availableLocales as string[] | null) ?? [];
  const defaultLocale = settings.defaultLocale;

  const otherPages = pages.filter((p) => {
    // The home page's slug is always "home" by convention (see
    // app/page.tsx) and renders at "/" instead — always skip it here.
    if (p.slug === "home") return false;
    // In one-page mode, an in_scroll page only redirects to "/#slug" (see
    // app/[slug]/page.tsx) rather than rendering at its own URL — not a
    // canonical page to list. Pages with in_scroll = false still get their
    // own standalone route either way.
    if (isOnePage && p.inScroll) return false;
    // seo_meta.unlisted — a link-only page (kept out of the menu too) that
    // must not be advertised anywhere a crawler looks. lib/seo.ts also
    // gives it a noindex robots tag and strips its hreflang alternates; a
    // noindex URL has no business being in the sitemap either.
    const seoMeta = p.seoMeta as { unlisted?: boolean; post?: PostMeta } | null;
    if (seoMeta?.unlisted === true) return false;
    // BSA Phase 22 — a "blog/{post_slug}" page only belongs in the sitemap
    // once it's actually published; a draft/scheduled post stays out (same
    // reasoning as unlisted, just time-gated instead of permanent — see
    // dev-steps-phase22-blog.txt Decided #6).
    if (seoMeta?.post && !isPublished(seoMeta.post)) return false;
    return true;
  });

  // BSA Phase 22 (US-VMAS-BLOG-06 AC5) — one archive URL per tag/category
  // that has at least one published post, carrying the same full hreflang
  // alternate set as every other page (built below via the same
  // localeUrl/alternatesFor helpers, byte-identical to lib/seo.ts's
  // blogArchiveMetadata). Draft/scheduled-only tags/categories are simply
  // never listed — getAllBlogPostPages + isPublished already excludes them.
  const publishedPosts = (await getAllBlogPostPages()).filter((p) => isPublished(p.post));
  const usedTags = new Set<string>();
  for (const p of publishedPosts) for (const t of p.post.tags ?? []) usedTags.add(t);
  const categories = await getBlogCategories();
  const usedCategorySlugs = new Set(
    categories.map((c) => c.slug).filter((slug) => publishedPosts.some((p) => p.post.categories?.includes(slug))),
  );
  const blogArchivePaths = [
    ...[...usedTags].map((t) => `/blog/tag/${t}`),
    ...[...usedCategorySlugs].map((c) => `/blog/category/${c}`),
  ];

  const paths = ["/", ...otherPages.map((p) => `/${p.slug}`), ...blogArchivePaths];
  const multiLocale = availableLocales.length > 1;

  // Audit fix C3 — every listed URL carries the full hreflang alternate
  // set (default locale = bare path, others = "/{locale}" prefix on the
  // same path, plus x-default), so localized pages are discoverable and
  // correctly associated from the sitemap alone, not only by parsing 30+
  // <head> <link> tags per page. Byte-identical to lib/seo.ts's alternates.
  // Skipped entirely for a single-language site (no <xhtml:link> noise).
  const localeUrl = (l: string, urlPath: string) =>
    l === defaultLocale ? `${base}${urlPath}` : `${base}/${l}${urlPath === "/" ? "" : urlPath}`;
  const alternatesFor = (urlPath: string): MetadataRoute.Sitemap[number]["alternates"] => {
    if (!multiLocale) return undefined;
    const languages: Record<string, string> = {};
    for (const l of availableLocales) languages[l] = localeUrl(l, urlPath);
    languages["x-default"] = `${base}${urlPath}`;
    return { languages };
  };

  // Audit follow-up — emit every localized URL as its own <url> entry with
  // its own <loc>, each carrying the identical full xhtml:link alternate set
  // (all locales + x-default). This is the symmetric form Google's
  // hreflang-in-sitemap docs specify: each language version self-references
  // and lists every other, so GSC's "Discovered URLs" count matches the real
  // localized page count and there's no ambiguity about which URL is the
  // indexable one per language. A single-language site still emits one plain
  // <url> per path.
  return paths.flatMap((urlPath) => {
    if (!multiLocale) return [{ url: `${base}${urlPath}` }];
    const alternates = alternatesFor(urlPath);
    return availableLocales.map((l) => ({ url: localeUrl(l, urlPath), alternates }));
  });
}
