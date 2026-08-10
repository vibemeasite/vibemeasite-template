import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSiteSettings } from "../lib/queries";

// stagingExpiresAt is the same signal StagingBanner (app/layout.tsx) already
// uses to know a site is still an unclaimed, time-boxed staging preview —
// block indexing entirely until the Site Owner actually claims/goes live, so
// a throwaway preview URL never ends up in search results.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  if (settings.stagingExpiresAt) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const headersList = await headers();
  const base = `https://${headersList.get("host")}`;

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
