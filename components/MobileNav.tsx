"use client";

import { useEffect, useState } from "react";

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
}

// The nav itself is plain server-renderable markup (just <a> tags) — the
// only thing that needs the client is the open/closed state for the
// hamburger toggle on narrow viewports, so that's all this component owns.
// Desktop layout is unaffected: .nav-links-top/.nav-links-side/.nav-extras
// are only ever hidden by the "is-open" gate inside a max-width media query.
export function MobileNav({ isSideNav, isOnePage, menu, phone, email, customLinks }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Closing on Escape and on viewport resize back to desktop keeps the
  // panel from getting stuck open if a user rotates a tablet or opens
  // devtools mid-interaction.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mql = window.matchMedia("(min-width: 769px)");
    const onMediaChange = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    mql.addEventListener("change", onMediaChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      mql.removeEventListener("change", onMediaChange);
    };
  }, [open]);

  const hasExtras = Boolean(phone || email || customLinks.length > 0);

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
          </div>
        )}
      </div>
    </>
  );
}
