import { formatPostDate } from "../lib/blog-render";
import type { BlogPostRow } from "../lib/blog-query";

// BSA Phase 22 — one card in the blog index/archive grid. Excerpt is
// `post.excerpt` as set by add_blog_post/update_blog_post, or blank if
// unset — v1 deliberately does NOT fall back to extracting text from the
// post's first Cellpy-block section for a card-grid render: that would mean
// one extra CDN fetch per card on every index/archive page view (N+1),
// which isn't worth it for a "no excerpt set" edge case an owner can just
// fix with update_blog_post. (The same plainTextExcerpt helper in
// lib/blog-render.ts stays available for a future opt-in single-post
// fallback, e.g. a "Read more" preview, where one extra fetch for one post
// is cheap.)
export function BlogPostCard({
  post, href, locale, categoryNames, tagNames,
}: {
  post: BlogPostRow;
  href: string;
  locale?: string;
  categoryNames?: Record<string, string>;
  tagNames?: Record<string, string>;
}) {
  const { title } = post;
  const { excerpt, featuredImage, publishedAt, author } = post.post;
  const tags = post.post.tags ?? [];
  const categories = post.post.categories ?? [];

  return (
    <a className="blog-card" href={href}>
      {featuredImage && <img className="blog-card__image" src={featuredImage} alt={title} loading="lazy" />}
      <h3 className="blog-card__title">{title}</h3>
      {excerpt && <p className="blog-card__excerpt">{excerpt}</p>}
      <div className="blog-card__meta">
        {publishedAt && <span>{formatPostDate(publishedAt, locale)}</span>}
        {author && <span>{author}</span>}
      </div>
      {(tags.length > 0 || categories.length > 0) && (
        <div className="blog-chip-row">
          {categories.map((c) => (
            <span key={`c-${c}`} className="blog-chip">{categoryNames?.[c] ?? c}</span>
          ))}
          {tags.map((t) => (
            <span key={`t-${t}`} className="blog-chip">{tagNames?.[t] ?? t}</span>
          ))}
        </div>
      )}
    </a>
  );
}
