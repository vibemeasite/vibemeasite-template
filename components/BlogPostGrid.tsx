import type { CSSProperties } from "react";
import { getBlogCategories, getBlogTags, type BlogPostRow } from "../lib/blog-query";
import { clampPage, type SearchParamsRecord } from "../lib/entries-query";
import { buildBlogQueryString, blogStyleVars, DEFAULT_BLOG_STYLE_CONFIG, type BlogStyleConfig } from "../lib/blog-render";
import { BlogPostCard } from "./BlogPostCard";

// BSA Phase 22 — the shared paginated post grid used by both the blog
// index and the tag/category archive pages (US-VMAS-BLOG-05/06) — same
// component so "no posts yet" / pagination / card rendering can't drift
// between the two.
export async function BlogPostGrid({
  rows, hasMore, searchParams, locale, emptyMessage, styleConfig = DEFAULT_BLOG_STYLE_CONFIG,
}: {
  rows: BlogPostRow[];
  hasMore: boolean;
  searchParams: SearchParamsRecord;
  locale?: string;
  emptyMessage: string;
  styleConfig?: BlogStyleConfig;
}) {
  const page = clampPage(searchParams.page);
  const [categories, tags] = await Promise.all([getBlogCategories(), getBlogTags()]);
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const tagNames = Object.fromEntries(tags.map((t) => [t.slug, t.name]));

  if (rows.length === 0) {
    return <p className="blog-empty">{emptyMessage}</p>;
  }

  return (
    // set_blog_style's knobs land as CSS custom properties here — every
    // descendant (.blog-card/.blog-chip/.blog-more in app/globals.css)
    // reads them via var(), so nothing below needs its own style prop
    // except BlogPostCard's showImage (a JS conditional, not CSS).
    <div className="blog-list-wrap" style={blogStyleVars(styleConfig) as CSSProperties}>
      <div className="blog-list">
        {rows.map((post) => (
          <BlogPostCard key={post.id} post={post} href={`/blog/${post.postSlug}`} locale={locale} categoryNames={categoryNames} tagNames={tagNames} styleConfig={styleConfig} />
        ))}
      </div>
      {hasMore && (
        <div className="blog-more-wrap">
          <a className="blog-more" href={buildBlogQueryString(searchParams, { page: page + 1 })}>Show more</a>
        </div>
      )}
    </div>
  );
}
