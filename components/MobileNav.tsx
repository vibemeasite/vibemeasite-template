"use client";

import { useEffect, useState } from "react";
import { flagSymbolForLocale, flagSpriteFile } from "../lib/lang-flags";

interface MenuItem {
  id: string;
  label: string;
  pageSlug: string;
  inScroll: boolean;
}

interface CustomLink {
  label: string;
  url: string;
}

interface MobileNavProps {
  isSideNav: boolean;
  isOnePage: boolean;
  menu: MenuItem[];
  phone: string | null;
  email: string | null;
  customLinks: CustomLink[];
  // Tier 2 — one prominent header call-to-action, distinct from the
  // plain-link customLinks. Rendered last in .nav-extras with class
  // .nav-cta (+ .nav-cta--button by default) so header_css / the theme
  // can style it as a real button.
  headerCta: { label: string; url: string; style: "button" | "link" } | null;
  // Phase 24 (Cellpy platform) — Multi-language Blocks, block-content-only
  // scope. `locale` is the currently-resolved language (see lib/locale.ts);
  // `availableLocales` is site_settings.available_locales. The switcher
  // itself is plain <a href="?lang={code}"> links — language switching is
  // navigation-based, not a live client-side swap (see bsa-documentation.md
  // § Phase 24 Scope) — middleware.ts persists the choice in a cookie so
  // only this first link needs the query param.
  locale: string;
  availableLocales: string[];
  // Set via vibemeasite-mcp's set_language_switcher_style tool.
  // "buttons" (plain <a> links, the original behavior) or "select" (a
  // collapsible dropdown list — a real <select> can't hold flag icons in
  // its options in any browser, so this is a custom <ul role="listbox">
  // built from the same <a href="?lang="> links, progressively enhanced
  // by public/lang-switcher.js — see the conditional <script> in
  // app/layout.tsx). langSwitcherFlags only applies to the "select"
  // presentation.
  langSwitcherStyle: "buttons" | "select";
  langSwitcherFlags: boolean;
}

// References a <symbol> in one of the public/flags/sprite-*.svg files (see
// lib/lang-flags.ts for why they're sprites split by size rather than a
// file per flag) — never an <img>, since a plain <img src="..."> would
// just show the whole (hidden) sprite sheet, not one flag.
function FlagIcon({ code }: { code: string }) {
  const symbolId = flagSymbolForLocale(code);
  return (
    <svg className="lang-flag" aria-hidden="true">
      <use href={`${flagSpriteFile(symbolId)}#${symbolId}`} />
    </svg>
  );
}

// The nav itself is plain server-renderable markup (just <a> tags) — the
// only thing that needs the client is the open/closed state for the
// hamburger toggle on narrow viewports, so that's all this component owns.
// Desktop layout is unaffected: .nav-links-top/.nav-links-side/.nav-extras
// are only ever hidden by the "is-open" gate inside a max-width media query.
export function MobileNav({
  isSideNav, isOnePage, menu, phone, email, customLinks, headerCta, locale, availableLocales,
  langSwitcherStyle, langSwitcherFlags,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Closing on Escape and on viewport resize back to desktop keeps the
  // panel from getting stuck open if a user rotates a tablet or opens
  // devtools mid-interaction.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mql = window.matchMedia("(min-width: 993px)");
    const onMediaChange = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    mql.addEventListener("change", onMediaChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      mql.removeEventListener("change", onMediaChange);
    };
  }, [open]);

  const showLangSwitcher = availableLocales.length > 1;
  const hasExtras = Boolean(phone || email || customLinks.length > 0 || headerCta || showLangSwitcher);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-toggle-bars" aria-hidden="true" />
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      <div
        id="site-nav-panel"
        className={isSideNav ? "nav-panel-side" : "nav-panel-top"}
        data-open={open}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === "A") setOpen(false);
        }}
      >
        <nav className={isSideNav ? "nav-links-side" : "nav-links-top"}>
          {menu.map((item) => {
            const href =
              isOnePage && item.inScroll
                ? `/#${item.pageSlug}`
                : item.pageSlug === "home"
                ? "/"
                : `/${item.pageSlug}`;
            return (
              <a key={item.id} href={href}>
                {item.label}
              </a>
            );
          })}
        </nav>
        {hasExtras && (
          <div className="nav-extras">
            {phone && <a href={`tel:${phone}`}>{phone}</a>}
            {email && <a href={`mailto:${email}`}>{email}</a>}
            {customLinks.map((link, i) => (
              <a key={i} href={link.url}>
                {link.label}
              </a>
            ))}
            {headerCta && (
              headerCta.url.startsWith("#") ? (
                // A "#id" target opens the matching <div class="cellpy-modal"
                // id="id"> via public/modal.js (rendered as a plain button so
                // it works on every page the modal container is present on —
                // e.g. one placed in set_footer). Falls back to nothing if no
                // such modal exists, same as any data-modal-open trigger.
                <button
                  type="button"
                  className={headerCta.style === "button" ? "nav-cta nav-cta--button" : "nav-cta"}
                  data-modal-open={headerCta.url.slice(1)}
                >
                  {headerCta.label}
                </button>
              ) : (
                <a
                  className={headerCta.style === "button" ? "nav-cta nav-cta--button" : "nav-cta"}
                  href={headerCta.url}
                >
                  {headerCta.label}
                </a>
              )
            )}
            {showLangSwitcher && (
              <span className="nav-lang-switcher">
                {langSwitcherStyle === "select" ? (
                  // Server-rendered as a plain, always-visible list of
                  // <a href="?lang="> links — identical in function to the
                  // "buttons" presentation, just with flag icons and
                  // wrapped for styling. public/lang-switcher.js
                  // progressively collapses this into a toggle button +
                  // dropdown list on load; the toggle button itself starts
                  // `hidden` (useless without JS) and the list stays
                  // expanded until the script hides it, so a site whose
                  // settings say "select" but hasn't been rebuilt onto a
                  // template version carrying the script yet just shows
                  // this expanded list instead — degrades, doesn't break.
                  <div className="lang-switcher" data-lang-switcher>
                    <button type="button" className="lang-switcher-toggle" aria-expanded="false" hidden>
                      {langSwitcherFlags && <FlagIcon code={locale} />}
                      <span className="lang-switcher-current">{locale.toUpperCase()}</span>
                      <span className="lang-switcher-caret" aria-hidden="true" />
                    </button>
                    <ul className="lang-switcher-menu" role="listbox">
                      {availableLocales.map((code) => (
                        <li key={code} role="option" aria-selected={code === locale}>
                          <a href={`?lang=${encodeURIComponent(code)}`} aria-current={code === locale ? "true" : undefined}>
                            {langSwitcherFlags && <FlagIcon code={code} />}
                            {code.toUpperCase()}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  availableLocales.map((code) => (
                    <a
                      key={code}
                      href={`?lang=${encodeURIComponent(code)}`}
                      aria-current={code === locale ? "true" : undefined}
                    >
                      {code.toUpperCase()}
                    </a>
                  ))
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
