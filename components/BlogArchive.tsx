import { getPublishedPosts, getBlogCategories, getBlogTags } from "../lib/blog-query";
import { getSiteSettings } from "../lib/queries";
import { getCurrentLocale } from "../lib/locale";
import type { BlogFilterConfig } from "../lib/blog-render";
import { clampPage, type SearchParamsRecord } from "../lib/entries-query";
import { BlogPostGrid } from "./BlogPostGrid";
import { BlogFilterWidget } from "./BlogFilterWidget";

// BSA Phase 22 (US-VMAS-BLOG-06 AC2/AC3) — a tag or category archive.
// Unlike the blog index, there's no `pages` row backing this URL (Decision
// 7) — no sections to render, no seo_meta to read. An unknown tag/category
// (no published post carries it) still renders — an empty state, never a
// 404 (AC3), so a brand-new tag starts working the instant it's used.
export async function BlogArchive({
  kind, value, searchParams,
}: {
  kind: "tag" | "category";
  value: string;
  searchParams: SearchParamsRecord;
}) {
  const page = clampPage(searchParams.page);
  const [{ rows, hasMore }, settings, categories, tags] = await Promise.all([
    getPublishedPosts(kind === "tag" ? { page, pageSize: 12, tags: [value] } : { page, pageSize: 12, categories: [value] }),
    getSiteSettings(),
    getBlogCategories(),
    getBlogTags(),
  ]);
  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  const filterConfig = settings.blogFilterConfig as BlogFilterConfig;

  const heading = kind === "tag"
    ? `Tag: ${tags.find((t) => t.slug === value)?.name ?? value}`
    : (categories.find((c) => c.slug === value)?.name ?? value);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      <h1>{heading}</h1>
      {/* Phase 22 amendment — pre-filled with the current archive
          dimension; always submits to /blog (BlogFilterWidget), where
          this value combines with whatever else the visitor picks. */}
      <BlogFilterWidget
        config={filterConfig}
        categories={categories}
        tags={tags}
        defaultTags={kind === "tag" ? [value] : undefined}
        defaultCategories={kind === "category" ? [value] : undefined}
      />
      <BlogPostGrid
        rows={rows}
        hasMore={hasMore}
        searchParams={searchParams}
        locale={locale}
        emptyMessage="No posts here yet."
      />
    </div>
  );
}
