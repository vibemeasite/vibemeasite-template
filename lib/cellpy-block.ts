import { unstable_cache } from "next/cache";

const CELLPY_CDN_BASE = process.env.CELLPY_CDN_BASE_URL ?? "https://cdn.cellpy.com";

export interface CellpyBlockContent {
  html: string;
  css: string;
  formConfig: unknown | null;
}

async function fetchContainerContent(
  accountSlug: string,
  containerSlug: string,
  locale?: string
): Promise<CellpyBlockContent | null> {
  const url = `${CELLPY_CDN_BASE}/${accountSlug}/containers/${containerSlug}.json`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const raw = (await res.json()) as {
    html?: string; css?: string; formConfig?: unknown;
    locales?: Record<string, { html?: string; css?: string; formConfig?: unknown }>;
  };
  // Phase 24 (Cellpy platform) — pick the current locale's content, falling
  // back to the root (default-language) fields when no translation exists.
  const localeEntry = locale ? raw.locales?.[locale] : undefined;
  const data = localeEntry ? { ...raw, ...localeEntry } : raw;
  if (typeof data.html !== "string") return null;

  return {
    html: data.html,
    css: typeof data.css === "string" ? data.css : "",
    formConfig: data.formConfig ?? null,
  };
}

// Server-side fetch of a container's assigned content — the equivalent of
// wp-cellpy's Cellpy_Render::fetch(). Wrapped in unstable_cache (matching
// lib/queries.ts's getSiteSettings/getMenu/getPageBySlug) rather than
// fetch()'s own `next: { tags }` option — confirmed by direct testing
// against a live deployment that plain fetch()-tagged entries do NOT
// reliably get busted by revalidateTag() on this Next.js version, while
// unstable_cache-tagged entries do (a known fetch-vs-unstable_cache
// divergence, e.g. https://github.com/vercel/next.js/discussions/78501).
// The inner fetch is `cache: "no-store"` since unstable_cache is now the
// only caching layer — double-caching would just reintroduce the same
// on-demand-revalidation gap this replaces. 30s revalidate matches
// Cellpy's own CDN Cache-Control (s-maxage=30) on container JSON, as a
// fallback safety net; the primary freshness signal is the
// `container-{slug}` tag, on-demand revalidated by vibemeasite-mcp right
// after every block publish (see app/api/revalidate/route.ts).
// `locale` (Phase 24, Cellpy platform) is folded into the cache key so each
// language of a container caches independently; the `container-{slug}` tag
// is deliberately left unqualified by locale, so a publish in ANY language
// still busts every cached locale variant of that container.
export function getContainerContent(
  accountSlug: string,
  containerSlug: string,
  locale?: string
): Promise<CellpyBlockContent | null> {
  return unstable_cache(
    () => fetchContainerContent(accountSlug, containerSlug, locale),
    ["container", accountSlug, containerSlug, locale ?? "default"],
    { revalidate: 30, tags: [`container-${containerSlug}`] }
  )();
}
