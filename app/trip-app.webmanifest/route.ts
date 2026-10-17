import { NextResponse } from "next/server";
import { getSiteSettings } from "../../lib/queries";

// BSA Phase 27 (slice 3, P12) — web app manifest, so a participant can
// install the site and open a downloaded trip offline from the home screen.
// Linked from app/layout.tsx ONLY when the Travel Kit is on (a dedicated
// route rather than app/manifest.ts, which would make every site installable).

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export async function GET() {
  const settings = await getSiteSettings();
  if (!(settings as { travelKitEnabled?: boolean }).travelKitEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const colors = (settings.colors as Record<string, string> | null) ?? {};
  const theme = HEX.test(colors.primary ?? "") ? colors.primary : "#1d5fd1";
  const background = HEX.test(colors.background ?? "") ? colors.background : "#ffffff";
  const name = settings.siteName || "Trips";
  // Only the logo: a .ico favicon is rejected as an app icon.
  const icons = [settings.logoUrl]
    .filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u))
    .map((src) => ({ src, sizes: "any", purpose: "any" }));

  return new NextResponse(
    JSON.stringify({
      name,
      short_name: name.length > 14 ? name.slice(0, 14) : name,
      start_url: "/trips",
      scope: "/",
      display: "standalone",
      theme_color: theme,
      background_color: background,
      icons,
    }),
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
