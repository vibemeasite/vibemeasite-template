import { SitePage } from "../components/SitePage";

// The home page's slug is always "home" by convention — see
// vibemeasite-mcp's create_site tool, which requires it as one of the
// site's pages.
export default function HomePage() {
  return <SitePage slug="home" />;
}
