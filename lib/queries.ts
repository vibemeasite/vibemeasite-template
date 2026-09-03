import { unstable_cache } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { pages, menuItems, containers, siteSettings, floatingWidgets, entities, entries } from "../db/schema";
import {
  buildEntriesWhere, resolveOrderBy, type EntityLite, type EntityFieldLite,
} from "./entries-query";

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
        logoHref: "/" as const,
        headerCta: null,
        bodyCss: null,
        stagingExpiresAt: null,
        defaultLocale: "en" as const,
        availableLocales: [] as string[],
        langSwitcherStyle: "buttons" as const,
        langSwitcherFlags: false,
        langSwitcherLabels: "code" as const,
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
// their own URL — see app/[slug]/page.tsx; + seoMeta, so it can also skip
// pages flagged seo_meta.unlisted — link-only pages that must stay out of
// the sitemap and the search index entirely, see lib/seo.ts). No <lastmod>
// data: pages has no created/updated timestamp column, out of scope for
// this pass.
export const getAllPages = unstable_cache(
  async () => {
    return db.select({ slug: pages.slug, inScroll: pages.inScroll, seoMeta: pages.seoMeta }).from(pages);
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

// ─── BSA Phase 16 — structured entities ─────────────────────────────────

function toEntityLite(row: typeof entities.$inferSelect): EntityLite {
  return {
    slug: row.slug,
    name: row.name,
    pluralLabel: row.pluralLabel,
    fields: ((row.fields as EntityFieldLite[]) ?? []).filter(
      (f) => f && typeof f.key === "string" && typeof f.type === "string",
    ),
    layout: row.layout,
    defaultSort: row.defaultSort,
    pageSize: row.pageSize,
    template: row.template,
  };
}

// The entity definition for a mount marker's slug. Tagged `entity-{slug}`
// so update_entity's revalidate call busts it.
export function getEntity(slug: string) {
  return unstable_cache(
    async (): Promise<EntityLite | null> => {
      const [row] = await db.select().from(entities).where(eq(entities.slug, slug)).limit(1);
      return row ? toEntityLite(row) : null;
    },
    ["entity", slug],
    { tags: [`entity-${slug}`] },
  )();
}

// Distinct languages that currently have at least one PUBLISHED row for
// this entity. EntityList / the pager route use it to resolve the visitor's
// locale to one that actually has content (falling back to the site
// default, then to showing everything) so a partly-translated directory
// never renders empty. Tagged `entity-{slug}` like every other entry read.
export function getEntryLangs(slug: string) {
  return unstable_cache(
    async (): Promise<string[]> => {
      const rows = await db
        .selectDistinct({ lang: entries.lang })
        .from(entries)
        .where(sql`${entries.entitySlug} = ${slug} and ${entries.status} = 'published'`);
      return rows.map((r) => r.lang).filter((l): l is string => typeof l === "string" && l.length > 0);
    },
    ["entry-langs", slug],
    { tags: [`entity-${slug}`] },
  )();
}

// Given the visitor's locale + the site default, pick the language whose
// rows should show: the visitor's own if it has any, else the default's,
// else undefined (no filter — show every language's rows rather than a
// blank directory).
export function resolveEntryLang(
  available: string[],
  locale: string,
  defaultLocale: string,
): string | undefined {
  if (available.includes(locale)) return locale;
  if (available.includes(defaultLocale)) return defaultLocale;
  return undefined;
}

export interface EntriesPageArgs {
  entity: EntityLite;
  q: string | undefined;
  facets: Record<string, string>;
  sort: string;
  page: number;
  pageSize: number;
  lang?: string;
}

export interface EntriesPageResult {
  rows: Array<{ id: string; dataJson: unknown; createdAt: string }>;
  hasMore: boolean;
}

// One paginated slice. The WHERE/ORDER BY come entirely from
// lib/entries-query.ts (schema-derived keys, bound values). Fetches
// pageSize + 1 to know whether a "more" link is needed. Tagged
// `entity-{slug}` — every add/update/delete/approve of an entry revalidates
// that tag from the vibemeasite-mcp side.
export function getEntriesPage(args: EntriesPageArgs): Promise<EntriesPageResult> {
  const { entity, q, facets, sort, page, pageSize, lang } = args;
  const cacheKey = JSON.stringify({ q: q ?? "", facets, sort, page, pageSize, lang: lang ?? "" });
  return unstable_cache(
    async (): Promise<EntriesPageResult> => {
      const where = buildEntriesWhere(entity, q, facets, lang);
      const orderBy = resolveOrderBy(entity, sort);
      const rows = await db
        .select({ id: entries.id, dataJson: entries.dataJson, createdAt: entries.createdAt })
        .from(entries)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize + 1)
        .offset((page - 1) * pageSize);
      const hasMore = rows.length > pageSize;
      return {
        rows: rows.slice(0, pageSize).map((r) => ({
          id: r.id,
          dataJson: r.dataJson,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        })),
        hasMore,
      };
    },
    ["entries-page", entity.slug, cacheKey],
    { tags: [`entity-${entity.slug}`] },
  )();
}

// Distinct values present for one filterable field, for the facet <select>.
// `fieldKey` is always one of the entity's own field keys (the caller only
// asks for filterable fields), so it's safe in the JSON path.
export function getFacetValues(slug: string, fieldKey: string, isTags: boolean, lang?: string) {
  return unstable_cache(
    async (): Promise<string[]> => {
      const expr = isTags
        ? sql<string>`jsonb_array_elements_text(${entries.dataJson} -> ${fieldKey})`
        : sql<string>`${entries.dataJson} ->> ${fieldKey}`;
      const langClause = lang ? sql` and ${entries.lang} = ${lang}` : sql``;
      const rows = await db
        .selectDistinct({ v: expr.as("v") })
        .from(entries)
        .where(
          sql`${entries.entitySlug} = ${slug} and ${entries.status} = 'published' and jsonb_exists(${entries.dataJson}, ${fieldKey})${langClause}`,
        )
        .orderBy(sql`v`)
        .limit(60);
      return rows.map((r) => r.v).filter((v): v is string => typeof v === "string" && v.length > 0);
    },
    ["facet-values", slug, fieldKey, lang ?? ""],
    { tags: [`entity-${slug}`] },
  )();
}
