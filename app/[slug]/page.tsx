import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SitePage } from "../../components/SitePage";
import { getPageBySlug, getSiteSettings } from "../../lib/queries";

// Only overrides the title when the site has set siteName — otherwise {}
// leaves the root layout's own fallback ("Site") untouched, so a site that
// hasn't configured siteName yet sees no change (see layout.tsx's own
// generateMetadata comment for the "%s | {siteName}" template this feeds).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [settings, result] = await Promise.all([getSiteSettings(), getPageBySlug(slug)]);
  if (!settings.siteName || !result) return {};
  return { title: result.page.title };
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
