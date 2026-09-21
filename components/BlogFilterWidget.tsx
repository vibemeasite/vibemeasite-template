import type { BlogFilterConfig } from "../lib/blog-render";

// BSA Phase 22 amendment — the blog index's optional search/tag/category
// widget. Always submits to /blog (a plain GET form, works with JS
// disabled) regardless of which page it's rendered from — an archive page
// (BlogArchive) shows it pre-filled with the current tag/category so a
// visitor can refine and jump to the richer, combinable /blog?q=&tag=&
// category= view; the crawlable /blog/tag/{x} and /blog/category/{y}
// archive routes themselves stay single-dimension and unaffected.
//
// Renders nothing if every piece is hidden (owner enabled the widget but
// turned off search/categories/tags individually) — an empty box with just
// a submit button would be confusing, not useful.
export function BlogFilterWidget({
  config, categories, tags, defaultQ, defaultTag, defaultCategory,
}: {
  config: BlogFilterConfig;
  categories: Array<{ slug: string; name: string }>;
  tags: Array<{ slug: string; name: string }>;
  defaultQ?: string;
  defaultTag?: string;
  defaultCategory?: string;
}) {
  if (!config.enabled) return null;
  const showSearch = config.showSearch;
  const showCategories = config.showCategories && categories.length > 0;
  const showTags = config.showTags && tags.length > 0;
  if (!showSearch && !showCategories && !showTags) return null;

  return (
    <form className="blog-filter-widget" method="get" action="/blog" role="search" aria-label="Search and filter blog posts">
      {showSearch && (
        <input
          type="search"
          name="q"
          defaultValue={defaultQ ?? ""}
          className="blog-filter-widget__q"
          placeholder="Search posts…"
          aria-label="Search posts"
        />
      )}
      {showCategories && (
        <select name="category" className="blog-filter-widget__select" defaultValue={defaultCategory ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      )}
      {showTags && (
        <select name="tag" className="blog-filter-widget__select" defaultValue={defaultTag ?? ""} aria-label="Tag">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
      )}
      <button type="submit" className="blog-filter-widget__go">Search</button>
    </form>
  );
}
