import { pgTable, text, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";

// Per-site schema, matching vibemeasite/docs/bsa-documentation-vibemeasite-service.md's
// US-VMAS-DEPLOY-03 Data model. This is the ONE canonical copy of a given
// site's structural content — visual section content lives on Cellpy's CDN
// instead (see components/CellpyBlock.tsx), referenced here only by slug.

export const pages = pgTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  layoutTree: jsonb("layout_tree"),
  seoMeta: jsonb("seo_meta"),
  // Only meaningful when site_settings.layout_mode = "one-page": true means
  // this page's containers render inline (as an anchor-scrollable section on
  // "/") instead of at their own "/{slug}" route. Defaults true so ordinary
  // multi-page sites are unaffected; a Site Owner can flag specific pages
  // (Privacy Policy, Terms) false to keep them as standalone routes even in
  // one-page mode.
  inScroll: boolean("in_scroll").notNull().default(true),
  // Header translation follow-up to Phase 24 — set via vibemeasite-mcp's
  // set_header_translations tool. { [lang]: title }. Slug/URL stays single
  // -language by design (see bsa-documentation.md § Phase 24 Scope) — only
  // the displayed title text varies; title itself (this row's own column)
  // remains the default-language/fallback value.
  titleTranslations: jsonb("title_translations"),
});

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  // Header translation follow-up to Phase 24 — { [lang]: label }, same
  // pattern as pages.titleTranslations.
  labelTranslations: jsonb("label_translations"),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  layoutConfig: jsonb("layout_config"),
});

// Maps a page's visual sections, in order, to Cellpy container slugs
// (containerSlug in vibemeasite-mcp's generate_block tool — see
// lib/cellpy-client.ts on the MCP side).
export const containers = pgTable("containers", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  cellpyContainerSlug: text("cellpy_container_slug").notNull(),
  position: integer("position").notNull().default(0),
});

// Whole-site layout choices (nav position, etc.) — distinct from
// `templates`, which is per-page. Single-row table; see the "nav position"
// discussion in the BSA doc's revision history.
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey(),
  navPosition: text("nav_position").notNull().default("top"), // "top" | "side"
  containerWidth: text("container_width").notNull().default("standard"), // "standard" | "wide"
  // "multi-page": every menu item links to its own "/{slug}" route (default).
  // "one-page": in-scroll pages (pages.in_scroll = true) render concatenated
  // on "/", with menu items linking to "#{slug}" anchors instead; pages with
  // in_scroll = false still get their own standalone route either way.
  // Decided once at create_site time (US-VMAS header/layout discussion).
  layoutMode: text("layout_mode").notNull().default("multi-page"),
  // Header content — set via set_branding, mutually exclusive with logoSvg
  // (whichever was set most recently wins; set_branding clears the other).
  logoUrl: text("logo_url"),
  // Raw inline SVG markup, validated (validateSvgLogo in block-validator)
  // before storage — rendered directly via dangerouslySetInnerHTML rather
  // than an <img src>, since it avoids a separate asset request and scales
  // losslessly. Never trust this column's contents without validation at
  // write time; nothing re-checks it at render time.
  logoSvg: text("logo_svg"),
  phone: text("phone"),
  email: text("email"),
  customLinks: jsonb("custom_links"), // Array<{ label: string, url: string }>
  // Free-form key -> hex/CSS-color-value map (e.g. { primary: "#1a5f4a",
  // text: "#222222" }), set via set_branding. Emitted as CSS custom
  // properties (--color-{key}) on :root in app/layout.tsx — globals.css
  // consumes them for the site's own chrome, and generate_block's tool
  // description tells Claude to use the same var(--color-*) names in
  // generated block CSS so blocks and chrome stay visually consistent.
  colors: jsonb("colors"),
  // Raw CSS text targeting the header's own class names (.nav-top,
  // .nav-side, .nav-brand, .nav-logo, .nav-logo-svg, .nav-links-top,
  // .nav-links-side, .nav-extras) — set via set_branding, rendered into a
  // <style> tag in <head> alongside the color vars. Deliberately not a
  // fixed set of named properties (background/text color, etc.): the point
  // is any CSS instruction (media queries, pseudo-classes, whatever) works
  // without ever needing a template code change or redeploy. Blocklist-
  // validated (@import, javascript:, expression() — see set_branding) since
  // "support all CSS" is incompatible with a strict allowlist; rendered as
  // a plain JSX text child (React escapes it), never dangerouslySetInnerHTML.
  headerCss: text("header_css"),
  // Staging-first claim flow (ADR-001) — null once the site is claimed.
  // Read in app/layout.tsx to render the countdown banner.
  stagingExpiresAt: timestamp("staging_expires_at"),
  // Phase 24 (Cellpy platform) — Multi-language Blocks. Page slugs/URLs stay
  // single-language by design (see bsa-documentation.md § Phase 24 Scope) —
  // nav labels and page titles gained translation support as a follow-up
  // (pages.titleTranslations / menuItems.labelTranslations). defaultLocale
  // is the fallback language and the value used when no ?lang= /
  // cellpy_lang cookie is present; availableLocales drives which options
  // the header switcher offers — both are just labels here, not enforced
  // against what a given container/page actually has translations for.
  defaultLocale: text("default_locale").notNull().default("en"),
  availableLocales: jsonb("available_locales").notNull().default([]),
  // Header language switcher presentation, follow-up to Phase 24 — set via
  // vibemeasite-mcp's set_language_switcher_style tool. "buttons" (row of
  // plain <a> links, the original/only behavior before this) or "select"
  // (a single <select> dropdown, progressively enhanced by
  // public/lang-switcher.js so it navigates on change). langSwitcherFlags
  // shows a flag emoji per language, looked up from a small code -> emoji
  // table in components/MobileNav.tsx rather than derived from the code —
  // stored independently of style so toggling style back and forth doesn't
  // lose the flags preference.
  langSwitcherStyle: text("lang_switcher_style").notNull().default("buttons"),
  langSwitcherFlags: boolean("lang_switcher_flags").notNull().default(false),
  // SEO/branding expansion — set via vibemeasite-mcp's set_branding.
  // siteName/tagline drive the page <title> (app/layout.tsx's
  // generateMetadata); falls back to the pre-existing static "Site" title
  // when unset, so nothing regresses for sites that haven't set it yet.
  siteName: text("site_name"),
  tagline: text("tagline"),
  // Auto-generated from the logo whenever it changes (see set_branding's
  // generateFavicon call), unless faviconSource is "custom" — a Site-Owner-
  // supplied favicon_url override that future logo edits leave alone.
  faviconUrl: text("favicon_url"),
  faviconSource: text("favicon_source"), // "auto" | "custom"
  // Analytics/SEO integration IDs — set via vibemeasite-mcp's
  // set_analytics. Public tracking IDs, not secrets. Rendered in
  // app/layout.tsx's <head>, skipped entirely while stagingExpiresAt is
  // set so staging preview traffic doesn't pollute the owner's real
  // analytics.
  gaId: text("ga_id"),
  gtmId: text("gtm_id"),
  metaPixelId: text("meta_pixel_id"),
  searchConsoleVerification: text("search_console_verification"),
  // Cookie Consent Banner (Phase 12) — set via vibemeasite-mcp's
  // set_cookie_banner. Opt-in (enabled defaults false), so a site that
  // never calls set_cookie_banner sees zero behavior change: ga_id/gtm_id/
  // meta_pixel_id keep loading unconditionally exactly as before (see
  // app/layout.tsx's consent-gate comment). This is the ONLY settings
  // column this feature has — the banner's actual content (message/button
  // labels/policy link/reopen icon), styling, and translations all live in
  // a real Cellpy block (fixed slug "cookie-banner", see
  // COOKIE_BANNER_CONTAINER_SLUG in app/layout.tsx) instead, reusing the
  // same locales-map/CSS-customization machinery the footer and booking
  // widget already have. An earlier version of this feature stored
  // message/labels/position/reopen-icon as their own settings columns
  // (migrations 0010/0011) — dropped in 0012 once the block-based rebuild
  // replaced them, before any live site had adopted it.
  cookieBannerEnabled: boolean("cookie_banner_enabled").notNull().default(false),
});

// Floating widgets — fixed-position buttons/popup-triggers, multiple per
// site (a phone button AND a promo popup trigger can coexist), set via
// vibemeasite-mcp's add_floating_widget/update_floating_widget/
// remove_floating_widget. This is deliberately a NARROW mirror of the
// control-plane vibemeasite-mcp floating_widgets table (db/schema.ts
// there) — only the fields app/layout.tsx needs synchronously to decide
// placement and whether to fetch a popup target. Icon/label/CSS are not
// duplicated here; they only matter for the trigger block's own CDN
// content, fetched via cellpyContainerSlug + getContainerContent, same as
// every other Cellpy block placement.
export const floatingWidgets = pgTable("floating_widgets", {
  id: text("id").primaryKey(),
  cellpyContainerSlug: text("cellpy_container_slug").notNull(),
  position: text("position").notNull(), // "bottom-right"|"bottom-left"|"top-right"|"top-left"|"mid-right"|"mid-left"|"bottom-center"
  deviceVisibility: text("device_visibility").notNull().default("all"), // "all"|"mobile"|"desktop"
  mode: text("mode").notNull(), // "link" | "popup"
  popupTargetContainerSlug: text("popup_target_container_slug"),
  popupStyle: text("popup_style"), // "modal" | "drawer"
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});
