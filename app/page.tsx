import { SitePage, ScrollPage } from "../components/SitePage";
import { getSiteSettings, getScrollPages } from "../lib/queries";

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
