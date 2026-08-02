import { SitePage, ScrollPage } from "../components/SitePage";
import { getSiteSettings, getScrollPages } from "../lib/queries";

// Without this, "/" has no dynamic route params so Next prerenders it as a
// fully static route (confirmed in the build output: "○ / 30s 1y" vs the
// dynamic-by-necessity "/[slug]") — every unstable_cache/fetch tag it reads
// gets attached to that route's own Full Route Cache entry too, and on a
// live deployment revalidateTag() was observed to correctly regenerate
// settings-tagged content but NOT container-tagged content on that same
// static route (root-caused by direct testing, not just theory — content
// stayed stale through repeated revalidateTag calls and past the 30s
// window). "/[slug]" never had this problem since a dynamic segment
// without generateStaticParams is inherently server-rendered per request
// (confirmed ƒ in the same build output), leaving unstable_cache as the
// only caching layer in play. force-dynamic makes "/" behave the same way,
// removing the extra static-route layer instead of chasing why it
// selectively fails to propagate one tag but not another.
export const dynamic = "force-dynamic";

// The home page's slug is always "home" by convention — see
// vibemeasite-mcp's create_site tool, which requires it as one of the
// site's pages. In one-page layout mode, "/" instead renders every
// in-scroll page's sections concatenated (see ScrollPage).
export default async function HomePage() {
  const settings = await getSiteSettings();
  if (settings.layoutMode === "one-page") {
    const sections = await getScrollPages();
    return <ScrollPage sections={sections} />;
  }
  return <SitePage slug="home" />;
}
