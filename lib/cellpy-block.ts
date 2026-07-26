const CELLPY_CDN_BASE = process.env.CELLPY_CDN_BASE_URL ?? "https://cdn.cellpy.com";

export interface CellpyBlockContent {
  html: string;
  css: string;
  formConfig: unknown | null;
}

// Server-side fetch of a container's assigned content — the equivalent of
// wp-cellpy's Cellpy_Render::fetch(). 30s revalidate matches Cellpy's own
// CDN Cache-Control (s-maxage=30) on container JSON, so content refreshes
// automatically without needing an explicit revalidate call per block edit
// (unlike menu/page structural edits, which have no such freshness signal
// and use on-demand revalidateTag instead — see app/api/revalidate/route.ts).
export async function getContainerContent(
  accountSlug: string,
  containerSlug: string
): Promise<CellpyBlockContent | null> {
  const url = `${CELLPY_CDN_BASE}/${accountSlug}/containers/${containerSlug}.json`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 30 } });
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
