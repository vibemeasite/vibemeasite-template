import { getPublishedPosts, getBlogCategories, getBlogTags } from "../lib/blog-query";
import { getSiteSettings } from "../lib/queries";
import { getCurrentLocale } from "../lib/locale";
import type { BlogFilterConfig, BlogStyleConfig } from "../lib/blog-render";
import type { SearchParamsRecord } from "../lib/entries-query";
import { clampPage } from "../lib/entries-query";
import { BlogPostGrid } from "./BlogPostGrid";
import { BlogFilterWidget } from "./BlogFilterWidget";

function firstStr(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.length > 0 ? s : undefined;
}

// Zero, one, or many — a dropdown submits at most one value for its name;
// chips (BSA Phase 22 amendment) can submit several, which the browser
// naturally expresses as repeated same-name query params, and Next's
// searchParams naturally parses as an array.
function readMulti(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).filter((s) => s.length > 0);
}

// BSA Phase 22 — the post grid on the blog INDEX page ("/blog"). The
// page's own sections (an optional owner-authored intro, US-VMAS-BLOG-05
// AC1) render through the ordinary SitePage pipeline unchanged; this
// component is composed right after it (see app/[[...path]]/page.tsx) so
// there's no need to duplicate SitePage's container/block-loading logic
// here — "blog" is a page like any other, this just adds the list below it.
//
// Phase 22 amendment — also reads ?q=/?tags=/?categories= (the optional
// filter widget's own query params, BlogFilterWidget) and renders the
// widget above the grid when the owner has enabled it
// (settings.blogFilterConfig). tags/categories are arrays — a dropdown
// selects at most one, chips can select several.
export async function BlogIndexPosts({ searchParams }: { searchParams: SearchParamsRecord }) {
  const page = clampPage(searchParams.page);
  const q = firstStr(searchParams.q);
  const tags = readMulti(searchParams.tags);
  const categories = readMulti(searchParams.categories);

  const [{ rows, hasMore }, settings, categoryRows, tagRows] = await Promise.all([
    getPublishedPosts({ page, pageSize: 12, q, tags, categories }),
    getSiteSettings(),
    getBlogCategories(),
    getBlogTags(),
  ]);
  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  const filterConfig = settings.blogFilterConfig as BlogFilterConfig;
  const styleConfig = settings.blogStyleConfig as BlogStyleConfig;

  return (
    <>
      <BlogFilterWidget config={filterConfig} categories={categoryRows} tags={tagRows} defaultQ={q} defaultTags={tags} defaultCategories={categories} />
      <BlogPostGrid
        rows={rows}
        hasMore={hasMore}
        searchParams={searchParams}
        locale={locale}
        emptyMessage={q || tags.length > 0 || categories.length > 0 ? "No posts match." : "Nothing published yet — check back soon."}
        styleConfig={styleConfig}
      />
    </>
  );
}
