import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPageBySlug, getSiteSettings } from "./queries";
import { getCurrentLocale, resolveTranslation } from "./locale";

interface PageSeoMeta {
  description?: string;
  descriptionTranslations?: Record<string, string>;
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
  const locale = await getCurrentLocale(settings.defaultLocale, availableLocales);

  const metadata: Metadata = {};

  // Only overrides the title when the site has set siteName — otherwise {}
  // leaves the root layout's own fallback ("Site") untouched, matching this
  // route's pre-existing behavior for a site that hasn't configured it yet.
  if (settings.siteName) {
    metadata.title = resolveTranslation(result.page.title, result.page.titleTranslations, locale);
  }

  const seoMeta = (result.page.seoMeta as PageSeoMeta | null) ?? null;
  if (seoMeta?.description) {
    metadata.description = resolveTranslation(seoMeta.description, seoMeta.descriptionTranslations, locale);
  }

  // US-VMAS-SEO-03 — hreflang alternates, only when there's more than one
  // declared language (zero <head> change for a single-language site). The
  // default locale maps to the bare URL, every other locale to ?lang={code}
  // on the same path — matching the site's existing query-param language
  // scheme; there is no path-based i18n routing to point at instead.
  if (availableLocales.length > 1) {
    const headersList = await headers();
    const base = `https://${headersList.get("host")}`;
    const languages: Record<string, string> = {};
    for (const l of availableLocales) {
      languages[l] = l === settings.defaultLocale ? `${base}${urlPath}` : `${base}${urlPath}?lang=${l}`;
    }
    languages["x-default"] = `${base}${urlPath}`;
    metadata.alternates = { languages };
  }

  return metadata;
}
