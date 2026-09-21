import { getBlogCategories, getBlogTags } from "../lib/blog-query";
import { formatPostDate, type PostMeta } from "../lib/blog-render";

// BSA Phase 22 (US-VMAS-BLOG-06 AC1) — wraps a post page's normally-
// rendered sections (its `generate_block` body, passed as `children` —
// unchanged SitePage output) with byline/date/tag/category chrome above
// and a "back to blog" link below. A draft/scheduled post still renders
// here at its real URL (see lib/seo.ts's noindex handling) — chrome-only,
// no gate: visibility is a listing/sitemap/RSS concern, not a render-time
// block on the page itself.
export async function BlogPostChrome({
  title, post, locale, children,
}: {
  title: string;
  post: PostMeta;
  locale?: string;
  children: React.ReactNode;
}) {
  const [categories, tagRows] = await Promise.all([getBlogCategories(), getBlogTags()]);
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const tagNames = Object.fromEntries(tagRows.map((t) => [t.slug, t.name]));
  const tags = post.tags ?? [];
  const postCategories = post.categories ?? [];

  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      {post.featuredImage && <img className="blog-post-banner" src={post.featuredImage} alt={title} />}
      <header className="blog-post-header">
        <h1>{title}</h1>
        <p className="blog-byline">
          {post.author ? `${post.author} · ` : ""}
          {formatPostDate(post.publishedAt, locale)}
        </p>
        {(tags.length > 0 || postCategories.length > 0) && (
          <div className="blog-chip-row">
            {postCategories.map((c) => (
              <a key={`c-${c}`} className="blog-chip" href={`/blog/category/${c}`}>{categoryNames[c] ?? c}</a>
            ))}
            {tags.map((t) => (
              <a key={`t-${t}`} className="blog-chip" href={`/blog/tag/${t}`}>{tagNames[t] ?? t}</a>
            ))}
          </div>
        )}
      </header>

      {children}

      <footer className="blog-post-footer">
        <a className="blog-back-link" href="/blog">← Back to Blog</a>
      </footer>
    </article>
  );
}
