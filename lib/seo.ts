import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPageBySlug, getSiteSettings } from "./queries";
import { getCurrentLocale, resolveTranslation } from "./locale";
import { ogLocale } from "./og-locale";

interface PageSeoMeta {
  description?: string;
  descriptionTranslations?: Record<string, string>;
  // A private, link-only page: not in the menu, not in the sitemap (see
  // app/sitemap.ts), noindex, and served in exactly one language — the
  // site default — regardless of ?lang= (see components/SitePage.tsx).
  unlisted?: boolean;
}

// Multilingual & SEO Tooling (Phase 13), US-VMAS-SEO-01/03 — shared by
// app/[slug]/page.tsx and app/page.tsx (home) so the two routes can't drift
// from each other. Fixes a pre-existing bug where a translated page's
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
  // seo_meta.unlisted — a private, link-only page has exactly one version,
  // in the site's default language. Pin the locale here so its <title>,
  // description, canonical and Open Graph never vary by ?lang=; the
  // hreflang alternates are dropped and a noindex robots tag is added
  // below, and SitePage renders the default-locale content to match.
  const isUnlisted = seoMeta?.unlisted === true;
  const locale = isUnlisted ? settings.defaultLocale : requestedLocale;

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
  const localizedTitle = isHomeWithConventionTitle ? brandedFallbackTitle : rawLocalizedTitle;

  if (settings.siteName && !isHomeWithConventionTitle) {
    metadata.title = rawLocalizedTitle;
  }

  const localizedDescription = seoMeta?.description
    ? resolveTranslation(seoMeta.description, seoMeta.descriptionTranslations, locale)
    : undefined;
  if (localizedDescription) {
    metadata.description = localizedDescription;
  }

  // The self-URL for the locale actually being rendered — kept byte-for-byte
  // identical to this locale's hreflang entry below so canonical and
  // hreflang never contradict. getCurrentLocale() has already collapsed an
  // unknown / stale ?lang= to defaultLocale, so "?lang=xx" and "?lang=en"
  // both canonicalise to the bare path here (audit fixes C1 + C2).
  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;
  const selfUrl =
    locale === settings.defaultLocale ? `${base}${urlPath}` : `${base}${urlPath}?lang=${locale}`;

  // US-VMAS-SEO-03 — hreflang alternates, only when there's more than one
  // declared language (zero <head> change for a single-language site). The
  // default locale maps to the bare URL, every other locale to ?lang={code}
  // on the same path — matching the site's existing query-param language
  // scheme; there is no path-based i18n routing to point at instead.
  // Skipped entirely for an unlisted page — it has only the one version.
  let languages: Record<string, string> | undefined;
  if (availableLocales.length > 1 && !isUnlisted) {
    languages = {};
    for (const l of availableLocales) {
      languages[l] = l === settings.defaultLocale ? `${base}${urlPath}` : `${base}${urlPath}?lang=${l}`;
    }
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
    ...(settings.logoUrl ? { images: [settings.logoUrl] } : {}),
    locale: ogLocale(locale),
    ...(availableLocales.length > 1 && !isUnlisted
      ? { alternateLocale: availableLocales.filter((l) => l !== locale).map(ogLocale) }
      : {}),
  };
  metadata.twitter = {
    card: settings.logoUrl ? "summary" : "summary_large_image",
    title: localizedTitle,
    ...(localizedDescription ? { description: localizedDescription } : {}),
    ...(settings.logoUrl ? { images: [settings.logoUrl] } : {}),
  };

  return metadata;
}
