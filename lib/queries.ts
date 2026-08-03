import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index";
import { pages, menuItems, containers, siteSettings } from "../db/schema";

// Tag-based revalidation (US-VMAS-MUTATE-01) only works for cached
// functions wrapped in unstable_cache (or fetch() calls with { next: { tags } }
// options) — plain drizzle queries aren't automatically cache-tagged just
// because @neondatabase/serverless happens to use fetch() internally.

export const getMenu = unstable_cache(
  async () => {
    return db
      .select({ id: menuItems.id, label: menuItems.label, pageSlug: pages.slug, inScroll: pages.inScroll })
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
