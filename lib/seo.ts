import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPageBySlug, getSiteSettings } from "./queries";
import { getCurrentLocale, resolveTranslation } from "./locale";
import { ogLocale } from "./og-locale";
import { getBlogCategories, getBlogTags } from "./blog-query";
import { isPublished, type PostMeta } from "./blog-render";

interface PageSeoMeta {
  description?: string;
  descriptionTranslations?: Record<string, string>;
  // Page-level SEO controls follow-up — set via vibemeasite-mcp's
  // (extended) set_page_seo. `title`, when present, renders as the page's
  // EXACT <title> (see the `{ absolute: ... }` override below), bypassing
  // the root layout's "%s | {siteName}" template entirely. `image`
  // overrides the site logo as the Open Graph / Twitter Card preview image
  // for this one page; never localized (a social preview image isn't
  // language-specific).
  title?: string;
  titleTranslations?: Record<string, string>;
  image?: string;
  // A private, link-only page: not in the menu, not in the sitemap (see
  // app/sitemap.ts), noindex, and its hreflang alternates dropped (moot —
  // a noindex page's alternates aren't crawled). Does NOT restrict which
  // language it renders in; see components/SitePage.tsx.
  unlisted?: boolean;
  // BSA Phase 22 — set on a "blog/{post_slug}" page only. A draft/scheduled
  // post (isPublished() false) gets the same noindex/no-alternates
  // treatment as `unlisted` below, WITHOUT actually being unlisted — it's
  // still in the menu/sitemap machinery's normal page set, just excluded
  // from the blog's own listings/sitemap entries/RSS (see lib/blog-query.ts,
  // app/sitemap.ts, app/blog/rss.xml/route.ts) and marked non-indexable
  // until it publishes (dev-steps-phase22-blog.txt Decided #6).
  post?: PostMeta;
}

// Multilingual & SEO Tooling (Phase 13), US-VMAS-SEO-01/03 — the shared
// generateMetadata helper for app/[[...path]]/page.tsx (every page, every
// locale). Fixes a pre-existing bug where a translated page's
// <title> stayed in the default language (title_translations existed but
// was never read in generateMetadata) and wires up pages.seo_meta (present
// in the schema since migration 0000, never previously read or written by
// any code path — see set_page_seo on the vibemeasite-mcp side).
export async function pageMetadata(slug: string, urlPath: string): Promise<Metadata> {
  const [settings, result] = await Promise.all([getSiteSettings(), getPageBySlug(slug)]);
  if (!result) return {};

  const availableLocales = (settings.availableLocales as string[] | null) ?? [];
  const requestedLocale = await getCurrentLocale(settings.defaultLocale, availableLocales);

  const seoMeta = (result.page.seoMeta as PageSeoMeta | null) ?? null;
  // seo_meta.unlisted only adds a noindex robots tag and drops hreflang
  // alternates below (an unindexed page's alternates are moot). <title>,
  // description, canonical and Open Graph all follow the ACTUAL requested
  // locale, same as any other page — SitePage renders that same locale's
  // content, so this must match or canonical/OG would describe content
  // other than what's on the page.
  // A draft/scheduled post (BSA Phase 22) gets the same noindex + dropped-
  // alternates treatment as an unlisted page — it's reachable at its real
  // URL (dev-steps Decided #6: "unlisted until published", not access-
  // controlled) but shouldn't be indexed or advertise language alternates
  // for content that isn't live yet.
  const isUnpublishedPost = !!seoMeta?.post && !isPublished(seoMeta.post);
  const isUnlisted = seoMeta?.unlisted === true || isUnpublishedPost;
  const locale = requestedLocale;

  const metadata: Metadata = {};

  if (isUnlisted) {
    metadata.robots = { index: false, follow: false };
  }

  // Only overrides the title when the site has set siteName — otherwise {}
  // leaves the root layout's own fallback ("Site") untouched, matching this
  // route's pre-existing behavior for a site that hasn't configured it yet.
  const rawLocalizedTitle = resolveTranslation(result.page.title, result.page.titleTranslations, locale);

  // Audit fix H5 — the home page's record title is always the bare
  // convention word "Home" (create_site requires slug "home"), which is a
  // wasted <title> on the single most important page. When that's all
  // there is (no real per-locale home-title translation), fall through to
  // the root layout's branded default ("{siteName} — {tagline}") by
  // leaving metadata.title unset. A genuine home-title translation still
  // wins.
  const isHomeWithConventionTitle = slug === "home" && rawLocalizedTitle === result.page.title;
  const brandedFallbackTitle =
    [settings.siteName, settings.tagline].filter(Boolean).join(" — ") || rawLocalizedTitle;

  // Page-level SEO controls — an explicit seo_meta.title wins over
  // everything above, including the home-page branded fallback: it's an
  // exact opt-out of the site-name-appending "%s | {siteName}" template
  // (app/layout.tsx's generateMetadata), via Next's `{ absolute: ... }`
  // title form, which a plain string title can never express since the
  // parent layout's template always applies to it.
  const seoTitleOverride = seoMeta?.title
    ? resolveTranslation(seoMeta.title, seoMeta.titleTranslations, locale)
    : undefined;
  const localizedTitle = seoTitleOverride ?? (isHomeWithConventionTitle ? brandedFallbackTitle : rawLocalizedTitle);

  if (seoTitleOverride) {
    metadata.title = { absolute: seoTitleOverride };
  } else if (settings.siteName && !isHomeWithConventionTitle) {
    metadata.title = rawLocalizedTitle;
  }

  const localizedDescription = seoMeta?.description
    ? resolveTranslation(seoMeta.description, seoMeta.descriptionTranslations, locale)
    : undefined;
  if (localizedDescription) {
    metadata.description = localizedDescription;
  }

  // Per-page social preview image — falls back to the site logo (pre-
  // existing behavior) when unset. Never localized (see PageSeoMeta.image).
  const socialImage = seoMeta?.image || settings.logoUrl;

  // The self-URL for the locale actually being rendered — kept byte-for-byte
  // identical to this locale's hreflang entry below so canonical and
  // hreflang never contradict. `urlPath` is always the path WITHOUT any
  // locale prefix (see app/[[...path]]/page.tsx).
  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;
  // Path-prefix i18n (template v15) — the default locale lives at the bare
  // path, every other locale under a "/{locale}" prefix. Replaces the
  // earlier "?lang={code}" query-param scheme. Byte-identical to the
  // sitemap's alternates.
  const localeUrl = (l: string) =>
    l === settings.defaultLocale
      ? `${base}${urlPath}`
      : `${base}/${l}${urlPath === "/" ? "" : urlPath}`;
  const selfUrl = localeUrl(locale);

  // US-VMAS-SEO-03 — hreflang alternates, only when there's more than one
  // declared language (zero <head> change for a single-language site).
  // Skipped entirely for an unlisted page — it has only the one version.
  let languages: Record<string, string> | undefined;
  if (availableLocales.length > 1 && !isUnlisted) {
    languages = {};
    for (const l of availableLocales) languages[l] = localeUrl(l);
    languages["x-default"] = `${base}${urlPath}`;
  }

  // Audit fix C1 — every page/locale gets an explicit self-referencing
  // canonical. Without it, "?lang=" parameter URLs are prone to being
  // folded onto "/" as duplicate parameter variants and dropped from the
  // index.
  metadata.alternates = { canonical: selfUrl, ...(languages ? { languages } : {}) };

  // Audit fix H2 — Open Graph + og:locale / og:locale:alternate, per
  // locale. Language-only OG values (see lib/og-locale.ts): a hint, not a
  // geo-targeting directive.
  metadata.openGraph = {
    type: "website",
    url: selfUrl,
    title: localizedTitle,
    ...(localizedDescription ? { description: localizedDescription } : {}),
    ...(settings.siteName ? { siteName: settings.siteName } : {}),
    ...(socialImage ? { images: [socialImage] } : {}),
    locale: ogLocale(locale),
    ...(availableLocales.length > 1 && !isUnlisted
      ? { alternateLocale: availableLocales.filter((l) => l !== locale).map(ogLocale) }
      : {}),
  };
  metadata.twitter = {
    // A real per-page social image (seoMeta.image) is treated as large-format
    // regardless of the logo fallback's own "summary" sizing below.
    card: seoMeta?.image ? "summary_large_image" : settings.logoUrl ? "summary" : "summary_large_image",
    title: localizedTitle,
    ...(localizedDescription ? { description: localizedDescription } : {}),
    ...(socialImage ? { images: [socialImage] } : {}),
  };

  return metadata;
}

// BSA Phase 22 (US-VMAS-BLOG-06 AC2) — metadata for a tag/category archive
// URL. Unlike pageMetadata above, there's no `pages` row or seo_meta to
// read (Decision 7) — just a title built from the tag/category name and
// the same canonical/hreflang-alternate shape every other page gets, built
// the same way (base URL from the request Host header, default locale =
// bare path) rather than importing pageMetadata's internals, matching how
// app/sitemap.ts already keeps its own copy of this same small helper.
export async function blogArchiveMetadata(kind: "tag" | "category", value: string, urlPath: string): Promise<Metadata> {
  const settings = await getSiteSettings();
  const availableLocales = (settings.availableLocales as string[] | null) ?? [];
  const locale = await getCurrentLocale(settings.defaultLocale, availableLocales);

  let label = value;
  if (kind === "category") {
    const categories = await getBlogCategories();
    label = categories.find((c) => c.slug === value)?.name ?? value;
  } else {
    const tags = await getBlogTags();
    label = tags.find((t) => t.slug === value)?.name ?? value;
  }
  const heading = kind === "tag" ? `Tag: ${label}` : label;
  const title = settings.siteName ? `${heading} – Blog | ${settings.siteName}` : `${heading} – Blog`;

  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;
  const localeUrl = (l: string) =>
    l === settings.defaultLocale ? `${base}${urlPath}` : `${base}/${l}${urlPath === "/" ? "" : urlPath}`;
  const selfUrl = localeUrl(locale);

  let languages: Record<string, string> | undefined;
  if (availableLocales.length > 1) {
    languages = {};
    for (const l of availableLocales) languages[l] = localeUrl(l);
    languages["x-default"] = `${base}${urlPath}`;
  }

  return {
    title: { absolute: title },
    alternates: { canonical: selfUrl, ...(languages ? { languages } : {}) },
    openGraph: { type: "website", url: selfUrl, title, ...(settings.siteName ? { siteName: settings.siteName } : {}), locale: ogLocale(locale) },
  };
}
