import { getPublishedPosts } from "../lib/blog-query";
import { getSiteSettings } from "../lib/queries";
import { getCurrentLocale } from "../lib/locale";
import type { SearchParamsRecord } from "../lib/entries-query";
import { clampPage } from "../lib/entries-query";
import { BlogPostGrid } from "./BlogPostGrid";

// BSA Phase 22 — the post grid on the blog INDEX page ("/blog"). The
// page's own sections (an optional owner-authored intro, US-VMAS-BLOG-05
// AC1) render through the ordinary SitePage pipeline unchanged; this
// component is composed right after it (see app/[[...path]]/page.tsx) so
// there's no need to duplicate SitePage's container/block-loading logic
// here — "blog" is a page like any other, this just adds the list below it.
export async function BlogIndexPosts({ searchParams }: { searchParams: SearchParamsRecord }) {
  const page = clampPage(searchParams.page);
  const [{ rows, hasMore }, settings] = await Promise.all([
    getPublishedPosts({ page, pageSize: 12 }),
    getSiteSettings(),
  ]);
  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  return (
    <BlogPostGrid
      rows={rows}
      hasMore={hasMore}
      searchParams={searchParams}
      locale={locale}
      emptyMessage="Nothing published yet — check back soon."
    />
  );
}
