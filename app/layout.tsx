import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { getMenu, getSiteSettings } from "../lib/queries";
import { getContainerContent } from "../lib/cellpy-block";
import { getCurrentLocale, resolveTranslation, isRtlLocale } from "../lib/locale";
import { CellpyBlock } from "../components/CellpyBlock";
import { StagingBanner } from "../components/StagingBanner";
import { MobileNav } from "../components/MobileNav";
import { FloatingWidgets } from "../components/FloatingWidgets";
import "./globals.css";

// Dynamic (not a static `export const metadata`) so it can read the site's
// own siteName/tagline (set via vibemeasite-mcp's set_branding). Falls back
// to the pre-existing static "Site" title when siteName is unset, so a site
// that hasn't configured it yet sees no change. When siteName IS set, the
// `template` here is what makes app/[slug]/page.tsx's own generateMetadata
// (just `{ title: page.title }`) come out as "{page title} | {siteName}"
// without that route needing to know the site name itself.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  if (!settings.siteName) return { title: "Site" };

  const defaultTitle = settings.tagline ? `${settings.siteName} — ${settings.tagline}` : settings.siteName;
  return { title: { default: defaultTitle, template: `%s | ${settings.siteName}` } };
}

// Same fixed slug on every site — not tied to any page, so it never goes
// through the per-page `containers` table like ordinary sections do.
// set_footer (vibemeasite-mcp) always publishes to this one slug; there's
// nothing to look up, just try the fetch and render nothing if it 404s
// (a site with no footer set yet), same as any other unset block.
const FOOTER_CONTAINER_SLUG = "site-footer";
// Same fixed-slug/sitewide pattern as the footer above — set_cookie_banner
// (vibemeasite-mcp) publishes a real Cellpy block here (fixed HTML
// skeleton + LLM-authored CSS, see lib/cookie-banner-template.ts on that
// side), rather than the settings-column approach this feature started
// with — reusing the same locales-map translation machinery and CSS
// customization the footer/booking widget already have, instead of
// hand-rolling both. Only rendered when cookie_banner_enabled (see below).
const COOKIE_BANNER_CONTAINER_SLUG = "cookie-banner";
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;

interface CustomLink {
  label: string;
  url: string;
  // Header translation follow-up to Phase 24 — { [lang]: label }, set via
  // vibemeasite-mcp's set_header_translations tool. url is never localized.
  labelTranslations?: Record<string, string>;
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

// Tier 2 — same allowed shapes as isSafeLinkUrl on the vibemeasite-mcp side
// (set_branding validates before storing; re-checked here, never trusted
// blindly from the DB — same defense-in-depth as sanitizeColors/logoSvg).
function isSafeHref(href: string): boolean {
  return /^(\/[^/]|\/$|\/#|#|https?:\/\/|mailto:|tel:)/.test(href.trim());
}

// Phase 12 — Cookie Consent Banner. What public/cookie-consent.js writes
// after a visitor decides; also read here, server-side, to gate GA/GTM/
// Meta Pixel below. Not read via middleware.ts (unlike cellpy_lang) since
// consent has no query-param source to reconcile — it's cookie-only, so
// next/headers cookies() alone is enough.
const CONSENT_COOKIE = "cellpy_consent";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [menu, settings] = await Promise.all([getMenu(), getSiteSettings()]);
  const availableLocales = (settings.availableLocales as string[] | null) ?? [];
  const locale = await getCurrentLocale(settings.defaultLocale, availableLocales);
  const footerContent = await getContainerContent(ACCOUNT_SLUG, FOOTER_CONTAINER_SLUG, locale);
  const isSideNav = settings.navPosition === "side";
  const isOnePage = settings.layoutMode === "one-page";
  const langSwitcherStyle = (settings.langSwitcherStyle as "buttons" | "select" | null) ?? "buttons";
  const langSwitcherLabels = (settings.langSwitcherLabels as "code" | "native" | "native_english" | null) ?? "code";
  const customLinks = ((settings.customLinks as CustomLink[] | null) ?? []).map((link) => ({
    ...link,
    label: resolveTranslation(link.label, link.labelTranslations, locale),
  }));
  const localizedMenu = menu.map((item) => ({
    ...item,
    label: resolveTranslation(item.label, item.labelTranslations, locale),
  }));
  const colors = sanitizeColors(settings.colors);
  const colorVars = Object.entries(colors)
    .map(([key, value]) => `--color-${key}: ${value};`)
    .join(" ");
  const headerCss = sanitizeHeaderCss(settings.headerCss);
  // Tier 2 — same blocklist sanitization as headerCss; targets <body>
  // site-wide (a gradient/textured page background the flat
  // --color-background token can't express).
  const bodyCss = sanitizeHeaderCss(settings.bodyCss);
  const headStyle = [colorVars ? `:root { ${colorVars} }` : "", headerCss, bodyCss].filter(Boolean).join("\n");

  // Tier 2 — logo link target (default "/") and the single header CTA.
  const rawLogoHref = typeof settings.logoHref === "string" && isSafeHref(settings.logoHref) ? settings.logoHref : "/";
  // Path-prefix i18n (v15) — keep a same-origin logo link inside the
  // current language (external / mailto: / tel: targets pass through).
  const logoHref =
    locale !== settings.defaultLocale && rawLogoHref.startsWith("/") && !rawLogoHref.startsWith("//")
      ? `/${locale}${rawLogoHref === "/" ? "" : rawLogoHref}`
      : rawLogoHref;
  const rawCta = settings.headerCta as { label?: unknown; url?: unknown; style?: unknown } | null;
  const headerCta =
    rawCta && typeof rawCta.label === "string" && typeof rawCta.url === "string" && isSafeHref(rawCta.url)
      ? { label: rawCta.label, url: rawCta.url, style: (rawCta.style === "link" ? "link" : "button") as "link" | "button" }
      : null;

  // Analytics/SEO integrations (set via vibemeasite-mcp's set_analytics) are
  // withheld entirely while a site is still an unclaimed staging preview
  // (stagingExpiresAt set) — same signal StagingBanner already uses — so
  // test traffic never pollutes the Site Owner's real GA/GTM/Pixel data.
  const isStaging = Boolean(settings.stagingExpiresAt);
  const searchConsoleVerification = !isStaging ? settings.searchConsoleVerification : null;

  // Cookie Consent Banner (Phase 12) — opt-in via cookie_banner_enabled, so
  // a site that never calls set_cookie_banner sees zero behavior change
  // (gaId/gtmId/metaPixelId below fall straight through to the pre-existing
  // !isStaging-only gate). Once enabled, GA/GTM/Meta Pixel additionally
  // require an explicit "accepted" cellpy_consent cookie — on first visit
  // (no cookie yet) or after Reject, these scripts are never server-
  // rendered at all, not merely hidden, so nothing gets a chance to set a
  // tracking cookie in the first place.
  const cookieBannerEnabled = Boolean(settings.cookieBannerEnabled);
  const consentCookie = (await cookies()).get(CONSENT_COOKIE)?.value;
  const consent: "accepted" | "rejected" | null =
    consentCookie === "accepted" || consentCookie === "rejected" ? consentCookie : null;
  const analyticsAllowed = !isStaging && (!cookieBannerEnabled || consent === "accepted");
  const gaId = analyticsAllowed ? settings.gaId : null;
  const gtmId = analyticsAllowed ? settings.gtmId : null;
  const metaPixelId = analyticsAllowed ? settings.metaPixelId : null;
  const cookieBannerContent = cookieBannerEnabled
    ? await getContainerContent(ACCOUNT_SLUG, COOKIE_BANNER_CONTAINER_SLUG, locale)
    : null;

  // Audit fix M2 — RTL languages (ar/he/fa/…) need dir="rtl" on <html>,
  // not just lang. Every other locale stays explicitly "ltr".
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  // Audit fix H4 — JSON-LD (Organization + WebSite site-wide, WebPage per
  // request with `inLanguage` = the locale actually rendered). URLs are
  // built from the request's own Host header (same rationale as
  // app/sitemap.ts) and the x-pathname header middleware.ts adds. Gated on
  // siteName so a site that hasn't run set_branding yet emits nothing new,
  // matching how the <title> override is gated.
  const hdrs = await headers();
  const base = `https://${hdrs.get("host")}`;
  const rawPath = hdrs.get("x-pathname") || "/";
  // Path-prefix i18n (template v15) — x-pathname still carries any
  // "/{locale}" prefix; strip it so the nav/switcher can rebuild links for
  // any target language, and so JSON-LD / canonical logic works off the
  // bare path. (For the default locale rawPath is already un-prefixed.)
  const currentPath =
    locale !== settings.defaultLocale && (rawPath === `/${locale}` || rawPath.startsWith(`/${locale}/`))
      ? rawPath.slice(locale.length + 1) || "/"
      : rawPath;
  const localePrefix = locale === settings.defaultLocale ? "" : `/${locale}`;
  const pageUrl = `${base}${localePrefix}${currentPath === "/" ? (localePrefix ? "" : "/") : currentPath}`;
  const jsonLd = settings.siteName
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.siteName,
          url: base,
          ...(settings.logoUrl ? { logo: new URL(settings.logoUrl, base).toString() } : {}),
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.siteName,
          url: base,
          inLanguage: settings.defaultLocale,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: pageUrl,
          inLanguage: locale,
          isPartOf: { "@type": "WebSite", url: base, name: settings.siteName },
        },
      ]
    : null;

  return (
    <html lang={locale} dir={dir}>
      <head>
        {settings.faviconUrl ? <link rel="icon" type="image/x-icon" href={settings.faviconUrl} /> : null}
        {searchConsoleVerification ? <meta name="google-site-verification" content={searchConsoleVerification} /> : null}
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
        {headStyle ? <style>{headStyle}</style> : null}
        {gtmId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        ) : null}
        {gaId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        ) : null}
        {metaPixelId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`,
            }}
          />
        ) : null}
      </head>
      <body>
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        {settings.stagingExpiresAt ? <StagingBanner expiresAt={new Date(settings.stagingExpiresAt).toISOString()} /> : null}
        <div className={isSideNav ? "layout-side" : "layout-top"}>
          <div className={isSideNav ? "nav-side" : "nav-top"}>
            <div className="nav-brand">
              {settings.logoSvg || settings.logoUrl ? (
                // Tier 2 — the logo is now a link (default "/"). Rendered
                // as a plain <a> (not next/link) since logoHref may be an
                // external URL; still same-tab, no rel needed for "/".
                <a className="nav-logo-link" href={logoHref} aria-label="Home">
                  {settings.logoSvg ? (
                    // Validated (forbids <script>, event handlers, javascript:
                    // URIs, <foreignObject>, etc. — see validateSvgLogo in
                    // block-validator) before ever being written to this column;
                    // never accept unvalidated SVG here.
                    <span className="nav-logo-svg" dangerouslySetInnerHTML={{ __html: settings.logoSvg }} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="nav-logo" src={settings.logoUrl!} alt="" />
                  )}
                </a>
              ) : null}
            </div>
            <MobileNav
              isSideNav={isSideNav}
              isOnePage={isOnePage}
              menu={localizedMenu}
              phone={settings.phone}
              email={settings.email}
              customLinks={customLinks}
              headerCta={headerCta}
              locale={locale}
              defaultLocale={settings.defaultLocale}
              currentPath={currentPath}
              availableLocales={availableLocales}
              langSwitcherStyle={langSwitcherStyle}
              langSwitcherFlags={settings.langSwitcherFlags ?? false}
              langSwitcherLabels={langSwitcherLabels}
            />
          </div>
          <main>{children}</main>
        </div>
        <CellpyBlock containerSlug={FOOTER_CONTAINER_SLUG} content={footerContent} />
        {/* Only the "select" presentation needs JS — "buttons" is plain
            <a href> links (see MobileNav.tsx). Present on every page (this
            is the root layout), same reasoning as MobileNav.tsx's own
            client bundle: it's conditioned on the site's settings, not on
            any one page's content, since the switcher itself is here too. */}
        {langSwitcherStyle === "select" && availableLocales.length > 1 && (
          <script src="/lang-switcher.js" defer />
        )}
        {/* Handles show/hide and the Accept/Reject/reopen clicks for the
            cookie banner block — the block's own HTML ships both elements
            `hidden` (see lib/cookie-banner-template.ts), so nothing shows
            at all without this script (same fail-safe posture as
            lang-switcher.js's toggle button). The block itself now renders
            inside FloatingWidgets below (its reopen control joins the same
            bottom-right stack as any floating widget there — see
            components/FloatingWidgets.tsx and globals.css's .fw-bucket
            comment) — this script still belongs here, not there, since
            it's gated purely on cookieBannerContent, unrelated to whether
            any floating widget exists. */}
        {cookieBannerContent ? <script src="/cookie-consent.js" defer /> : null}
        {/* modal.js / copy-button.js are normally enqueued per-page by
            SitePage.tsx, but a connect-style modal placed in the sitewide
            footer (set_footer) — opened by the header CTA when header_cta's
            url is a "#id" — lives outside any page's blocks, so load them
            here too when the footer itself carries the markers. Both scripts
            self-guard against double-init. */}
        {footerContent?.html.includes("data-modal-open") ? <script src="/modal.js" defer /> : null}
        {footerContent?.html.includes("data-copy") ? <script src="/copy-button.js" defer /> : null}
        {(headerCta?.url.startsWith("#") && !footerContent?.html.includes("data-modal-open")) ? (
          <script src="/modal.js" defer />
        ) : null}
        <FloatingWidgets locale={locale} cookieBannerContent={cookieBannerContent} />
      </body>
    </html>
  );
}
