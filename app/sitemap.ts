import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAllPages, getSiteSettings } from "../lib/queries";

// No reliable domain env var exists in this template (each site is its own
// Vercel project, and custom domains vs. the default vercel.app URL both
// need to work) — building the base URL from the incoming request's own
// Host header, same as any other per-deployment absolute URL here, avoids
// needing one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;

  const [pages, settings] = await Promise.all([getAllPages(), getSiteSettings()]);
  const isOnePage = settings.layoutMode === "one-page";

  const otherPages = pages.filter((p) => {
    // The home page's slug is always "home" by convention (see
    // app/page.tsx) and renders at "/" instead — always skip it here.
    if (p.slug === "home") return false;
    // In one-page mode, an in_scroll page only redirects to "/#slug" (see
    // app/[slug]/page.tsx) rather than rendering at its own URL — not a
    // canonical page to list. Pages with in_scroll = false still get their
    // own standalone route either way.
    if (isOnePage && p.inScroll) return false;
    return true;
  });

  return [{ url: `${base}/` }, ...otherPages.map((p) => ({ url: `${base}/${p.slug}` }))];
}
