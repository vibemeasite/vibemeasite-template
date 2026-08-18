import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SitePage } from "../../components/SitePage";
import { getPageBySlug, getSiteSettings } from "../../lib/queries";
import { pageMetadata } from "../../lib/seo";

// Phase 13 (VibeMeASite), US-VMAS-SEO-01 — delegates to the shared
// pageMetadata() helper (locale-resolved title/description + hreflang) so
// this route and app/page.tsx (home) can't drift from each other. See
// lib/seo.ts for the "only overrides title when siteName is set" fallback
// this preserves from before.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(slug, `/${slug}`);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getSiteSettings();

  if (settings.layoutMode === "one-page") {
    // in_scroll pages don't get their own route in one-page mode — send a
    // direct visit (or stale bookmark/search-engine hit) back to its anchor
    // on "/" instead of rendering it twice under two different URLs.
    const result = await getPageBySlug(slug);
    if (!result) notFound();
    if (result.page.inScroll) redirect(`/#${slug}`);
  }

  return <SitePage slug={slug} />;
}
