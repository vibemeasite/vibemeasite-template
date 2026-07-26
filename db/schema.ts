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
});

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
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
  // Staging-first claim flow (ADR-001) — null once the site is claimed via
  // either path. Read in app/layout.tsx to render the countdown banner.
  stagingExpiresAt: timestamp("staging_expires_at"),
  // Path B (Cellpy-hosted) non-payment after the billing grace period sets
  // this true — app/layout.tsx short-circuits to a static "temporarily
  // unavailable" page instead of real content when set. A direct DB write
  // from lib/teardown.ts's pauseCellpyHostedSite, not a Vercel API call, so
  // it takes effect immediately with no redeploy (same zero-rebuild model
  // as every other post-launch mutation here).
  paused: boolean("paused").notNull().default(false),
});
