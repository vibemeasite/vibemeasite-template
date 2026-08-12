"use client";

import { useState } from "react";

// Phase 12 — Cookie Consent Banner. Rendered from app/layout.tsx only when
// site_settings.cookie_banner_enabled is true. The cookie this component
// writes (CONSENT_COOKIE) is what app/layout.tsx reads server-side, via
// next/headers cookies(), to decide whether to server-render the GA/GTM/
// Meta Pixel <script> tags at all — "Reject" works by making sure those
// scripts are never emitted in the first place, not by hiding them after
// the fact. See that file's own comment for the full gate.
const CONSENT_COOKIE = "cellpy_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matches every other long-lived cookie in this codebase (cellpy_lang)

// Prefixes cover GA4 (_ga, _ga_<property>), Universal Analytics/GTM
// (_gat, _gat_gtag_<id>), and Meta Pixel (_fbp, _fbc) plus Google's
// cross-domain linker (_gcl_au) — a prefix match rather than exact names
// since the property/container ID is baked into several of these.
const TRACKING_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_fbp", "_fbc", "_gcl_au"];

function purgeTrackingCookies() {
  const names = document.cookie
    .split("; ")
    .map((pair) => pair.split("=")[0])
    .filter((name) => name && TRACKING_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix)));

  for (const name of names) {
    // Host-only cookies clear with just a path match; GA/Meta more often
    // set theirs on the registrable domain, so also try the explicit
    // leading-dot domain form — an unmatched domain attribute is simply
    // ignored by the browser, so this is harmless when it doesn't apply.
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
  }
}

export interface CookieBannerProps {
  initialConsent: "accepted" | "rejected" | null;
  message: string;
  acceptLabel: string;
  rejectLabel: string;
  policyUrl: string | null;
  position: "bar" | "corner";
}

export function CookieBanner({ initialConsent, message, acceptLabel, rejectLabel, policyUrl, position }: CookieBannerProps) {
  const [open, setOpen] = useState(initialConsent === null);
  const hasDecision = initialConsent !== null;

  // Reload rather than swap client-side state: the GA/GTM/Meta Pixel
  // bootstrap snippets live once, server-side, in app/layout.tsx's <head> —
  // duplicating that logic here to inject them dynamically wasn't judged
  // worth the extra surface for a chrome-level widget (same trade-off the
  // language switcher already makes for a language change).
  function decide(choice: "accepted" | "rejected") {
    if (choice === "rejected") purgeTrackingCookies();
    document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax`;
    window.location.reload();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="cookie-settings-reopen"
        aria-label="Cookie settings"
        onClick={() => setOpen(true)}
      >
        🍪
      </button>
    );
  }

  return (
    <div className={`cookie-banner cookie-banner--${position}`} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p className="cookie-banner-message">
        {message}
        {policyUrl ? (
          <>
            {" "}
            <a href={policyUrl} target="_blank" rel="noreferrer">
              Learn more
            </a>
          </>
        ) : null}
      </p>
      <div className="cookie-banner-actions">
        {/* Only offered once a decision already exists — the very first
            prompt requires an actual choice, not a silent dismiss. */}
        {hasDecision ? (
          <button type="button" className="cookie-banner-dismiss" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        ) : null}
        <button type="button" className="cookie-banner-reject" onClick={() => decide("rejected")}>
          {rejectLabel}
        </button>
        <button type="button" className="cookie-banner-accept" onClick={() => decide("accepted")}>
          {acceptLabel}
        </button>
      </div>
    </div>
  );
}
