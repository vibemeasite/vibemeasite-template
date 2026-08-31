import { NextResponse, type NextRequest } from "next/server";

// Phase 24 (Cellpy platform) — Multi-language Blocks, block-content-only
// scope (see bsa-documentation.md § Phase 24). Layouts (app/layout.tsx)
// can't read searchParams — only params/headers — so this middleware
// converts a `?lang=` query param into a request header every server
// component can read via next/headers `headers()`, and persists the choice
// in a cookie so a header switcher click only needs `?lang=` on the first
// link: subsequent in-site navigation carries the language via the cookie
// without repeating the query param on every href.
const LANG_HEADER = "x-cellpy-lang";
const LANG_COOKIE = "cellpy_lang";
const PATH_HEADER = "x-pathname";

// Multilingual SEO audit (2026-08-31), fix C2 — a coarse BCP-47 shape gate
// so an arbitrary ?lang= value ("xx", "<script>", "../../etc") never
// becomes a persisted cookie or an x-cellpy-lang header. This is only the
// syntactic filter; lib/locale.ts still validates the value against the
// site's actually-declared languages before it affects any rendered URL.
const LANG_TAG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function middleware(req: NextRequest) {
  const rawQueryLang = req.nextUrl.searchParams.get("lang");
  const queryLang = rawQueryLang && LANG_TAG_RE.test(rawQueryLang) ? rawQueryLang : null;
  const lang = queryLang || req.cookies.get(LANG_COOKIE)?.value;

  const requestHeaders = new Headers(req.headers);
  if (lang) requestHeaders.set(LANG_HEADER, lang);
  // So server components / lib/seo.ts can build absolute self-URLs and
  // JSON-LD without next/navigation's client-only usePathname.
  requestHeaders.set(PATH_HEADER, req.nextUrl.pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (queryLang && queryLang !== req.cookies.get(LANG_COOKIE)?.value) {
    res.cookies.set(LANG_COOKIE, queryLang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  return res;
}

export const config = {
  // Skip static assets and Next internals — no reason to run this on every
  // request for /_next/*, favicon, etc.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
