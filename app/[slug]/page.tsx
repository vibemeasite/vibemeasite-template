import { notFound, redirect } from "next/navigation";
import { SitePage } from "../../components/SitePage";
import { getPageBySlug, getSiteSettings } from "../../lib/queries";

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
