import { NextResponse, type NextRequest } from "next/server";

// Phase 24 (Cellpy platform) — Multi-language Blocks. Layouts
// (app/layout.tsx) can't read searchParams — only params/headers — so this
// middleware resolves the request's language and exposes it as the
// `x-cellpy-lang` request header every server component reads via
// next/headers `headers()`.
//
// Path-prefix i18n (template v15) — the language now lives in the URL path
// ("/fr/pricing"), not a "?lang=fr" query param. This middleware:
//   1. 308-redirects any legacy "?lang=" URL to its path-prefix equivalent.
//   2. Reads a leading locale-shaped path segment into `x-cellpy-lang` and
//      refreshes the `cellpy_lang` cookie from it (the cookie is still used
//      by the catch-all route's "sticky language" redirect for bare
//      in-content links, and by public/booking.js).
// It deliberately does NOT rewrite the path — the catch-all route
// (app/[...path]) receives the locale segment as a param and validates it
// against the site's real declared languages, so middleware never has to
// know that list and a page slugged like a locale code can't collide.
const LANG_HEADER = "x-cellpy-lang";
const LANG_COOKIE = "cellpy_lang";
const PATH_HEADER = "x-pathname";
const YEAR = 60 * 60 * 24 * 365;

// Loose shape gate for a "?lang=" value (kept from the query-param era) —
// stops "?lang=<script>" etc. from ever becoming a redirect target/cookie.
const LANG_TAG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
// Stricter shape for a leading PATH segment — matches lib/locale.ts's
// isLocaleShaped. Tight enough to tell "fr" / "zh-CN" apart from an
// ordinary page slug; the catch-all route still validates against the
// site's actual language list before it means anything.
const LOCALE_SEG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const firstSeg = segments[0] ?? "";
  const pathHasLocalePrefix = LOCALE_SEG_RE.test(firstSeg);

  // 1) Legacy ?lang= → 308 to the path-prefix form. Strip the param; if the
  //    value is locale-shaped, move it into the path (replacing any locale
  //    segment already there). A non-locale-shaped value (e.g. "?lang=xx"
  //    junk) just drops the param — the catch-all route then canonicalises
  //    an unknown leading segment to the bare path anyway.
  const rawQueryLang = req.nextUrl.searchParams.get("lang");
  if (rawQueryLang !== null) {
    const dest = req.nextUrl.clone();
    dest.searchParams.delete("lang");
    const rest = pathHasLocalePrefix ? segments.slice(1) : segments;
    const value = rawQueryLang.trim();
    const localePart = LANG_TAG_RE.test(value) ? [value] : [];
    dest.pathname = "/" + [...localePart, ...rest].join("/");
    return NextResponse.redirect(dest, 308);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PATH_HEADER, pathname);
  if (pathHasLocalePrefix) requestHeaders.set(LANG_HEADER, firstSeg);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (pathHasLocalePrefix && req.cookies.get(LANG_COOKIE)?.value !== firstSeg) {
    res.cookies.set(LANG_COOKIE, firstSeg, { path: "/", maxAge: YEAR });
  }

  return res;
}

export const config = {
  // Skip static assets and Next internals — no reason to run this on every
  // request for /_next/*, favicon, etc.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
