"use client";

import { useEffect, useState } from "react";
import { flagForLocale } from "../lib/lang-flags";

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
  // single dropdown, enhanced by public/lang-switcher.js — see the
  // conditional <script> in app/layout.tsx). langSwitcherFlags only
  // applies to the "select" presentation.
  langSwitcherStyle: "buttons" | "select";
  langSwitcherFlags: boolean;
}

// The nav itself is plain server-renderable markup (just <a> tags) — the
// only thing that needs the client is the open/closed state for the
// hamburger toggle on narrow viewports, so that's all this component owns.
// Desktop layout is unaffected: .nav-links-top/.nav-links-side/.nav-extras
// are only ever hidden by the "is-open" gate inside a max-width media query.
export function MobileNav({
  isSideNav, isOnePage, menu, phone, email, customLinks, locale, availableLocales,
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
  const hasExtras = Boolean(phone || email || customLinks.length > 0 || showLangSwitcher);

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
            {showLangSwitcher && (
              <span className="nav-lang-switcher">
                {langSwitcherStyle === "select" ? (
                  // Plain uncontrolled <select> — navigation on change is
                  // handled by public/lang-switcher.js, not React, so this
                  // component's own client bundle (shipped on every page,
                  // for the hamburger toggle) doesn't grow for sites that
                  // never chose this presentation. Without that script (a
                  // site whose settings say "select" but that hasn't been
                  // rebuilt onto a template version carrying it yet), the
                  // dropdown still shows the current language, it just
                  // won't navigate on change — same "degrades, doesn't
                  // break" tradeoff as forms.js.
                  <select data-lang-switcher defaultValue={locale} aria-label="Language">
                    {availableLocales.map((code) => (
                      <option key={code} value={code}>
                        {langSwitcherFlags ? `${flagForLocale(code)} ` : ""}
                        {code.toUpperCase()}
                      </option>
                    ))}
                  </select>
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
