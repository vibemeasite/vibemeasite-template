import { getPublishedPosts, getBlogCategories, getBlogTags } from "../lib/blog-query";
import { getSiteSettings } from "../lib/queries";
import { getCurrentLocale } from "../lib/locale";
import type { BlogFilterConfig } from "../lib/blog-render";
import type { SearchParamsRecord } from "../lib/entries-query";
import { clampPage } from "../lib/entries-query";
import { BlogPostGrid } from "./BlogPostGrid";
import { BlogFilterWidget } from "./BlogFilterWidget";

function firstStr(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.length > 0 ? s : undefined;
}

// BSA Phase 22 — the post grid on the blog INDEX page ("/blog"). The
// page's own sections (an optional owner-authored intro, US-VMAS-BLOG-05
// AC1) render through the ordinary SitePage pipeline unchanged; this
// component is composed right after it (see app/[[...path]]/page.tsx) so
// there's no need to duplicate SitePage's container/block-loading logic
// here — "blog" is a page like any other, this just adds the list below it.
//
// Phase 22 amendment — also reads ?q=/?tag=/?category= (the optional
// filter widget's own query params, BlogFilterWidget) and renders the
// widget above the grid when the owner has enabled it
// (settings.blogFilterConfig).
export async function BlogIndexPosts({ searchParams }: { searchParams: SearchParamsRecord }) {
  const page = clampPage(searchParams.page);
  const q = firstStr(searchParams.q);
  const tag = firstStr(searchParams.tag);
  const category = firstStr(searchParams.category);

  const [{ rows, hasMore }, settings, categories, tags] = await Promise.all([
    getPublishedPosts({ page, pageSize: 12, q, tag, category }),
    getSiteSettings(),
    getBlogCategories(),
    getBlogTags(),
  ]);
  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  const filterConfig = settings.blogFilterConfig as BlogFilterConfig;

  return (
    <>
      <BlogFilterWidget config={filterConfig} categories={categories} tags={tags} defaultQ={q} defaultTag={tag} defaultCategory={category} />
      <BlogPostGrid
        rows={rows}
        hasMore={hasMore}
        searchParams={searchParams}
        locale={locale}
        emptyMessage={q || tag || category ? "No posts match." : "Nothing published yet — check back soon."}
      />
    </>
  );
}
