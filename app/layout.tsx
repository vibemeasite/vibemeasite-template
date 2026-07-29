import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getMenu, getSiteSettings } from "../lib/queries";
import { getContainerContent } from "../lib/cellpy-block";
import { CellpyBlock } from "../components/CellpyBlock";
import { StagingBanner } from "../components/StagingBanner";
import { MobileNav } from "../components/MobileNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site",
};

// Same fixed slug on every site — not tied to any page, so it never goes
// through the per-page `containers` table like ordinary sections do.
// set_footer (vibemeasite-mcp) always publishes to this one slug; there's
// nothing to look up, just try the fetch and render nothing if it 404s
// (a site with no footer set yet), same as any other unset block.
const FOOTER_CONTAINER_SLUG = "site-footer";
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;

interface CustomLink {
  label: string;
  url: string;
}

// Rendered raw into a <style> tag below — even though set_branding (the
// only writer of this column) validates before storing, re-validate here
// too rather than trust the database blindly, same defense-in-depth as
// this repo's other dangerouslySetInnerHTML sink (the logoSvg column).
const COLOR_KEY_RE = /^[a-z][a-z0-9-]{0,30}$/;
const COLOR_VALUE_RE = /^[#a-zA-Z0-9(),.%\s-]{1,50}$/;

function sanitizeColors(colors: unknown): Record<string, string> {
  if (!colors || typeof colors !== "object") return {};
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (!COLOR_KEY_RE.test(key) || !COLOR_VALUE_RE.test(value)) continue;
    safe[key] = value;
  }
  return safe;
}

// Blocklist, not an allowlist — "support all CSS instructions" (arbitrary
// selectors/properties/media queries) is the point, so this only rejects
// the handful of universally-dangerous constructs rather than restricting
// syntax. Rendered as a plain JSX text child below (never
// dangerouslySetInnerHTML), so React itself HTML-escapes it — no separate
// "</style>" breakout check is needed the way it would be with raw string
// concatenation outside JSX.
const CSS_FORBIDDEN_RE = /@import|javascript:|expression\s*\(/i;

function sanitizeHeaderCss(css: unknown): string {
  if (typeof css !== "string" || CSS_FORBIDDEN_RE.test(css)) return "";
  return css;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [menu, settings, footerContent] = await Promise.all([
    getMenu(),
    getSiteSettings(),
    getContainerContent(ACCOUNT_SLUG, FOOTER_CONTAINER_SLUG),
  ]);
  const isSideNav = settings.navPosition === "side";
  const isOnePage = settings.layoutMode === "one-page";
  const customLinks = (settings.customLinks as CustomLink[] | null) ?? [];
  const colors = sanitizeColors(settings.colors);
  const colorVars = Object.entries(colors)
    .map(([key, value]) => `--color-${key}: ${value};`)
    .join(" ");
  const headerCss = sanitizeHeaderCss(settings.headerCss);
  const headStyle = [colorVars ? `:root { ${colorVars} }` : "", headerCss].filter(Boolean).join("\n");

  return (
    <html lang="en">
      <head>{headStyle ? <style>{headStyle}</style> : null}</head>
      <body>
        {settings.stagingExpiresAt ? <StagingBanner expiresAt={settings.stagingExpiresAt.toISOString()} /> : null}
        <div className={isSideNav ? "layout-side" : "layout-top"}>
          <div className={isSideNav ? "nav-side" : "nav-top"}>
            <div className="nav-brand">
              {settings.logoSvg ? (
                // Validated (forbids <script>, event handlers, javascript:
                // URIs, <foreignObject>, etc. — see validateSvgLogo in
                // block-validator) before ever being written to this column;
                // never accept unvalidated SVG here.
                <span className="nav-logo-svg" dangerouslySetInnerHTML={{ __html: settings.logoSvg }} />
              ) : settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="nav-logo" src={settings.logoUrl} alt="" />
              ) : null}
            </div>
            <MobileNav
              isSideNav={isSideNav}
              isOnePage={isOnePage}
              menu={menu}
              phone={settings.phone}
              email={settings.email}
              customLinks={customLinks}
            />
          </div>
          <main>{children}</main>
        </div>
        <CellpyBlock containerSlug={FOOTER_CONTAINER_SLUG} content={footerContent} />
      </body>
    </html>
  );
}
