const CELLPY_CDN_BASE = process.env.CELLPY_CDN_BASE_URL ?? "https://cdn.cellpy.com";

export interface CellpyBlockContent {
  html: string;
  css: string;
  formConfig: unknown | null;
}

// Server-side fetch of a container's assigned content — the equivalent of
// wp-cellpy's Cellpy_Render::fetch(). 30s revalidate matches Cellpy's own
// CDN Cache-Control (s-maxage=30) on container JSON, as a fallback safety
// net. The primary freshness signal is now the `container-{slug}` tag,
// on-demand revalidated by vibemeasite-mcp right after every block publish
// (see app/api/revalidate/route.ts) — the passive 30s poll alone was found
// to silently wedge indefinitely if a single background-revalidation fetch
// ever errored, leaving stale content served with no retry.
export async function getContainerContent(
  accountSlug: string,
  containerSlug: string
): Promise<CellpyBlockContent | null> {
  const url = `${CELLPY_CDN_BASE}/${accountSlug}/containers/${containerSlug}.json`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 30, tags: [`container-${containerSlug}`] } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as { html?: string; css?: string; formConfig?: unknown };
  if (typeof data.html !== "string") return null;

  return {
    html: data.html,
    css: typeof data.css === "string" ? data.css : "",
    formConfig: data.formConfig ?? null,
  };
}
