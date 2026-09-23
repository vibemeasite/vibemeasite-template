import { sanitizeBlogFilterCss, type BlogFilterConfig } from "../lib/blog-render";

// BSA Phase 22 amendment — the blog index's optional search/tag/category
// widget. Always submits to /blog (a plain GET form, works with JS
// disabled) regardless of which page it's rendered from — an archive page
// (BlogArchive) shows it pre-filled with the current tag/category so a
// visitor can refine and jump to the richer, combinable /blog?q=&tags=&
// categories= view; the crawlable /blog/tag/{x} and /blog/category/{y}
// archive routes themselves stay single-dimension and unaffected.
//
// Renders nothing if every piece is hidden (owner enabled the widget but
// turned off search/categories/tags individually) — an empty box with just
// a submit button would be confusing, not useful.
//
// Each of categories/tags independently renders as either a single-select
// <select> (default, "dropdown") or a row of multiselectable checkbox
// "chips" (config.*Style === "chips") — a later same-amendment addition.
// Chips are plain checkboxes sharing one `name`, visually replaced by
// their `<label>` via the adjacent-sibling CSS selector (.blog-chip-toggle
// in globals.css) — no JS needed, and every checked box becomes its own
// query-string value, which is how the browser natively expresses "more
// than one selected" on a GET form.
export function BlogFilterWidget({
  config, categories, tags, defaultQ, defaultTags, defaultCategories,
}: {
  config: BlogFilterConfig;
  categories: Array<{ slug: string; name: string }>;
  tags: Array<{ slug: string; name: string }>;
  defaultQ?: string;
  defaultTags?: string[];
  defaultCategories?: string[];
}) {
  if (!config.enabled) return null;
  const showSearch = config.showSearch;
  const showCategories = config.showCategories && categories.length > 0;
  const showTags = config.showTags && tags.length > 0;
  if (!showSearch && !showCategories && !showTags) return null;

  const selectedTags = new Set(defaultTags ?? []);
  const selectedCategories = new Set(defaultCategories ?? []);
  const autoSubmit = config.submitMode === "auto";

  return (
    <form
      className={autoSubmit ? "blog-filter-widget blog-filter-widget--auto" : "blog-filter-widget"}
      method="get"
      action="/blog"
      role="search"
      aria-label="Search and filter blog posts"
    >
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
        config.categoriesStyle === "chips" ? (
          <fieldset className="blog-filter-widget__chips blog-filter-widget__chips--categories">
            <legend className="sr-only">Category</legend>
            {categories.map((c) => (
              <span key={c.slug} className="blog-chip-option blog-chip-option--categories">
                <input type="checkbox" id={`fw-cat-${c.slug}`} name="categories" value={c.slug} defaultChecked={selectedCategories.has(c.slug)} className="blog-chip-checkbox" />
                <label htmlFor={`fw-cat-${c.slug}`} className="blog-chip-toggle blog-chip-toggle--categories">{c.name}</label>
              </span>
            ))}
          </fieldset>
        ) : (
          <select name="categories" className="blog-filter-widget__select blog-filter-widget__select--categories" defaultValue={defaultCategories?.[0] ?? ""} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )
      )}

      {showTags && (
        config.tagsStyle === "chips" ? (
          <fieldset className="blog-filter-widget__chips blog-filter-widget__chips--tags">
            <legend className="sr-only">Tag</legend>
            {tags.map((t) => (
              <span key={t.slug} className="blog-chip-option blog-chip-option--tags">
                <input type="checkbox" id={`fw-tag-${t.slug}`} name="tags" value={t.slug} defaultChecked={selectedTags.has(t.slug)} className="blog-chip-checkbox" />
                <label htmlFor={`fw-tag-${t.slug}`} className="blog-chip-toggle blog-chip-toggle--tags">{t.name}</label>
              </span>
            ))}
          </fieldset>
        ) : (
          <select name="tags" className="blog-filter-widget__select blog-filter-widget__select--tags" defaultValue={defaultTags?.[0] ?? ""} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        )
      )}

      <button type="submit" className="blog-filter-widget__go">Search</button>
      {autoSubmit && <script src="/blog-filter-auto-submit.js" defer />}
      {config.css && <style>{sanitizeBlogFilterCss(config.css)}</style>}
    </form>
  );
}
