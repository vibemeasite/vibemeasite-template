import { unstable_cache } from "next/cache";
import { asc, like } from "drizzle-orm";
import { db } from "../db/index";
import { pages, blogCategories, blogTags } from "../db/schema";
import { getPageBySlug } from "./queries";
import { isPublished, type PostMeta } from "./blog-render";

// BSA Phase 22 — a post is a `pages` row (slug "blog/{post_slug}") with its
// metadata inline on seo_meta.post (see db/schema.ts's comment). This is
// the one module that reads/filters/paginates that set — components
// (BlogIndex, BlogArchive) and the RSS route all go through it so the
// "published" rule can't drift (dev-steps-phase22-blog.txt Decision 4/10).

export interface BlogPostRow {
  id: string;
  slug: string; // "blog/{post_slug}"
  postSlug: string;
  title: string;
  post: PostMeta;
}

interface PageSeoMetaWithPost {
  post?: PostMeta;
}

export const getBlogCategories = unstable_cache(
  async () => db.select().from(blogCategories).orderBy(asc(blogCategories.name)),
  ["blog-categories"],
  { tags: ["blog-categories"] },
);

// Phase 22 amendment — tags are a real taxonomy now (blog_tags), same shape
// as getBlogCategories. Used everywhere a tag SLUG (stored on
// post.tags) needs its display NAME resolved for rendering.
export const getBlogTags = unstable_cache(
  async () => db.select().from(blogTags).orderBy(asc(blogTags.name)),
  ["blog-tags"],
  { tags: ["blog-tags"] },
);

// Every "blog/*" page that carries post metadata — small at this platform's
// scale (a site's whole blog), so filtering/sorting/paginating happens in
// JS rather than three separate SQL query shapes for plain/tag/category
// (dev-steps Decision: "keeps ONE code path ... instead of three query
// variants").
export const getAllBlogPostPages = unstable_cache(
  async (): Promise<BlogPostRow[]> => {
    const rows = await db.select().from(pages).where(like(pages.slug, "blog/%"));
    const out: BlogPostRow[] = [];
    for (const row of rows) {
      const post = (row.seoMeta as PageSeoMetaWithPost | null)?.post;
      if (!post) continue;
      out.push({ id: row.id, slug: row.slug, postSlug: row.slug.slice("blog/".length), title: row.title, post });
    }
    return out;
  },
  ["blog-posts"],
  { tags: ["pages", "blog-index"] },
);

export interface GetPublishedPostsOpts {
  page: number;
  pageSize: number;
  // Zero or more slugs. Empty/omitted = no filter on that dimension.
  // Multiple values OR together within a dimension ("tag A or tag B"),
  // same as tags/categories AND together across dimensions — the
  // conventional faceted-search shape, and what the chips-style widget
  // needs (BSA Phase 22 amendment: multiselectable chips, an alternative
  // to the single-select dropdown). A single-select dropdown just produces
  // a 0-or-1-length array, so both widget styles feed the same filter.
  tags?: string[];
  categories?: string[];
  // BSA Phase 22 amendment (blog filter widget) — plain substring match
  // against title + excerpt, case-insensitive. Posts have no search_text/
  // pg_trgm column (unlike Phase 16 entries) — this operates on the same
  // already-cached getAllBlogPostPages() set the tag/category filters use,
  // which is small at this platform's scale, so a JS .includes() pass
  // needs no new index/column.
  q?: string;
}

export interface PublishedPostsResult {
  rows: BlogPostRow[];
  hasMore: boolean;
}

export async function getPublishedPosts(opts: GetPublishedPostsOpts): Promise<PublishedPostsResult> {
  const all = await getAllBlogPostPages();
  let filtered = all.filter((p) => isPublished(p.post));
  const tags = opts.tags?.filter(Boolean) ?? [];
  const categories = opts.categories?.filter(Boolean) ?? [];
  if (tags.length > 0) filtered = filtered.filter((p) => p.post.tags?.some((t) => tags.includes(t)));
  if (categories.length > 0) filtered = filtered.filter((p) => p.post.categories?.some((c) => categories.includes(c)));
  const q = opts.q?.trim().toLowerCase();
  if (q && q.length >= 2 && q.length <= 80) {
    filtered = filtered.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.post.excerpt ?? "").toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => new Date(b.post.publishedAt ?? 0).getTime() - new Date(a.post.publishedAt ?? 0).getTime());

  const start = (opts.page - 1) * opts.pageSize;
  const rows = filtered.slice(start, start + opts.pageSize);
  const hasMore = start + opts.pageSize < filtered.length;
  return { rows, hasMore };
}

// Thin wrapper — a post is a normal page, so its own content/SEO fetch is
// the existing getPageBySlug (Decision 2: no second fetch path for a post).
export function getPostBySlug(postSlug: string) {
  return getPageBySlug(`blog/${postSlug}`);
}
