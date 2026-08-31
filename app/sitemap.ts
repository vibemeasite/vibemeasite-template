import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAllPages, getSiteSettings } from "../lib/queries";

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
    return true;
  });

  const paths = ["/", ...otherPages.map((p) => `/${p.slug}`)];

  // Audit fix C3 — every listed URL carries the full hreflang alternate
  // set (default locale = bare path, others = ?lang={code}, plus
  // x-default), so localized pages are discoverable and correctly
  // associated from the sitemap alone, not only by parsing 30+ <head>
  // <link> tags per page. Byte-identical to lib/seo.ts's alternates.
  // Skipped entirely for a single-language site (no <xhtml:link> noise).
  const alternatesFor = (urlPath: string): MetadataRoute.Sitemap[number]["alternates"] => {
    if (availableLocales.length <= 1) return undefined;
    const languages: Record<string, string> = {};
    for (const l of availableLocales) {
      languages[l] = l === defaultLocale ? `${base}${urlPath}` : `${base}${urlPath}?lang=${l}`;
    }
    languages["x-default"] = `${base}${urlPath}`;
    return { languages };
  };

  return paths.map((urlPath) => ({
    url: `${base}${urlPath}`,
    alternates: alternatesFor(urlPath),
  }));
}
