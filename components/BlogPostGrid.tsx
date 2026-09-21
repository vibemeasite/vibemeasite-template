import { getBlogCategories, type BlogPostRow } from "../lib/blog-query";
import { clampPage, withParams, type SearchParamsRecord } from "../lib/entries-query";
import { BlogPostCard } from "./BlogPostCard";

// BSA Phase 22 — the shared paginated post grid used by both the blog
// index and the tag/category archive pages (US-VMAS-BLOG-05/06) — same
// component so "no posts yet" / pagination / card rendering can't drift
// between the two.
export async function BlogPostGrid({
  rows, hasMore, searchParams, locale, emptyMessage,
}: {
  rows: BlogPostRow[];
  hasMore: boolean;
  searchParams: SearchParamsRecord;
  locale?: string;
  emptyMessage: string;
}) {
  const page = clampPage(searchParams.page);
  const categories = await getBlogCategories();
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  if (rows.length === 0) {
    return <p className="blog-empty">{emptyMessage}</p>;
  }

  return (
    <div className="blog-list-wrap">
      <div className="blog-list">
        {rows.map((post) => (
          <BlogPostCard key={post.id} post={post} href={`/blog/${post.postSlug}`} locale={locale} categoryNames={categoryNames} />
        ))}
      </div>
      {hasMore && (
        <div className="blog-more-wrap">
          <a className="blog-more" href={withParams(searchParams, { page: page + 1 })}>Show more</a>
        </div>
      )}
    </div>
  );
}
