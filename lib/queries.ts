import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index";
import { pages, menuItems, containers, siteSettings, floatingWidgets } from "../db/schema";

// Tag-based revalidation (US-VMAS-MUTATE-01) only works for cached
// functions wrapped in unstable_cache (or fetch() calls with { next: { tags } }
// options) — plain drizzle queries aren't automatically cache-tagged just
// because @neondatabase/serverless happens to use fetch() internally.

// labelTranslations is returned raw (not locale-resolved here) — the
// underlying data is identical regardless of visitor language, so
// resolving it per-locale doesn't need its own cache entry per language;
// callers (app/layout.tsx) resolve it via resolveTranslation() after the
// single cached fetch, the same way customLinks labels are resolved.
export const getMenu = unstable_cache(
  async () => {
    return db
      .select({
        id: menuItems.id, label: menuItems.label, labelTranslations: menuItems.labelTranslations,
        pageSlug: pages.slug, inScroll: pages.inScroll,
      })
      .from(menuItems)
      .innerJoin(pages, eq(menuItems.pageId, pages.id))
      .orderBy(asc(menuItems.order));
  },
  ["menu"],
  { tags: ["menu"] }
);

export const getSiteSettings = unstable_cache(
  async () => {
    const rows = await db.select().from(siteSettings).limit(1);
    return (
      rows[0] ?? {
        navPosition: "top" as const,
        containerWidth: "standard" as const,
        layoutMode: "multi-page" as const,
        logoUrl: null,
        logoSvg: null,
        phone: null,
        email: null,
        customLinks: null,
        colors: null,
        headerCss: null,
        stagingExpiresAt: null,
        defaultLocale: "en" as const,
        availableLocales: [] as string[],
        langSwitcherStyle: "buttons" as const,
        langSwitcherFlags: false,
        siteName: null,
        tagline: null,
        faviconUrl: null,
        faviconSource: null,
        gaId: null,
        gtmId: null,
        metaPixelId: null,
        searchConsoleVerification: null,
        cookieBannerEnabled: false,
      }
    );
  },
  ["site-settings"],
  { tags: ["settings"] }
);

export interface ScrollPageSection {
  slug: string;
  title: string;
  containers: Array<{ cellpyContainerSlug: string }>;
}

// Only used in one-page layout mode (site_settings.layout_mode) — every
// in-scroll page's containers, concatenated in menu order, for rendering
// as anchor-scrollable sections on "/" instead of separate routes. Pages
// with no menu item still render (sorted after menu'd ones, by slug) since
// they're still part of the site, just unreachable from the nav.
export const getScrollPages = unstable_cache(
  async () => {
    const rows = await db
      .select({ id: pages.id, slug: pages.slug, title: pages.title, order: menuItems.order })
      .from(pages)
      .leftJoin(menuItems, eq(menuItems.pageId, pages.id))
      .where(eq(pages.inScroll, true));

    const seen = new Set<string>();
    const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    deduped.sort((a, b) => {
      if (a.order == null && b.order == null) return a.slug.localeCompare(b.slug);
      if (a.order == null) return 1;
      if (b.order == null) return -1;
      return a.order - b.order;
    });

    const sections: ScrollPageSection[] = [];
    for (const p of deduped) {
      const pageContainers = await db
        .select({ cellpyContainerSlug: containers.cellpyContainerSlug })
        .from(containers)
        .where(eq(containers.pageId, p.id))
        .orderBy(asc(containers.position));
      sections.push({ slug: p.slug, title: p.title, containers: pageContainers });
    }
    return sections;
  },
  ["scroll-pages"],
  { tags: ["menu", "pages"] }
);

// Every page's slug (+ inScroll, so app/sitemap.ts can skip pages that only
// redirect to a "/#slug" anchor in one-page mode rather than rendering at
// their own URL — see app/[slug]/page.tsx). No <lastmod> data: pages has no
// created/updated timestamp column, out of scope for this pass.
export const getAllPages = unstable_cache(
  async () => {
    return db.select({ slug: pages.slug, inScroll: pages.inScroll }).from(pages);
  },
  ["all-pages"],
  { tags: ["pages"] }
);

// Floating widgets (fixed-position buttons/popup-triggers) — set via
// vibemeasite-mcp's add_floating_widget/update_floating_widget. Only enabled
// rows: remove_floating_widget soft-removes (enabled: false) rather than
// deleting, same as cookie_banner_enabled, so app/layout.tsx never needs to
// distinguish "never configured" from "configured, currently off" itself.
export const getFloatingWidgets = unstable_cache(
  async () => {
    return db
      .select()
      .from(floatingWidgets)
      .where(eq(floatingWidgets.enabled, true))
      .orderBy(asc(floatingWidgets.sortOrder));
  },
  ["floating-widgets"],
  { tags: ["floating-widgets"] }
);

export function getPageBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const [page] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
      if (!page) return null;

      const pageContainers = await db
        .select({ cellpyContainerSlug: containers.cellpyContainerSlug })
        .from(containers)
        .where(eq(containers.pageId, page.id))
        .orderBy(asc(containers.position));

      return { page, containers: pageContainers };
    },
    ["page", slug],
    { tags: ["pages", `page-${slug}`] }
  )();
}
