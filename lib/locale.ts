import { headers } from "next/headers";

// Phase 24 (Cellpy platform) — reads the language middleware.ts resolved
// from ?lang= / the cellpy_lang cookie, falling back to the site's
// configured default. Callable from any server component (layout.tsx,
// SitePage.tsx) since next/headers `headers()` — unlike searchParams —
// is available in layouts too.
//
// Multilingual SEO audit (2026-08-31), fix C4 — the bare "/" URL (and any
// path with no ?lang=) ALWAYS renders `defaultLocale`. An earlier revision
// also sniffed Accept-Language here as a silent default; that made the
// canonical / hreflang="x-default" URL locale-adaptive (different content
// per request, no `Vary: Accept-Language`), which risks Google associating
// the wrong content with x-default and lets a shared cache cross-serve
// languages. A visitor's language is now only ever an explicit choice
// (?lang= / the cellpy_lang cookie), never inferred from request headers.
//
// Fix C2 — the `x-cellpy-lang` header (set by middleware.ts from ?lang= or
// the cellpy_lang cookie) is validated against the site's declared
// languages before it is trusted. A typo, a stale cookie left over from a
// language the site later dropped, or a crawler probing "?lang=xx" must
// not leak into <html lang>, the hreflang self-reference, or the canonical
// URL — those all fall back to `defaultLocale` (so the page canonicalises
// to "/"). Matching is case-insensitive but the site's own casing
// (availableLocales / defaultLocale) is returned, so every downstream URL
// is byte-identical to the hreflang alternates. availableLocales defaults
// to [] so pre-existing call sites keep compiling until updated to pass
// the real list (they then only ever get `defaultLocale` back, unchanged).
export async function getCurrentLocale(defaultLocale: string, availableLocales: string[] = []): Promise<string> {
  const hdrs = await headers();
  const explicit = hdrs.get("x-cellpy-lang");
  if (explicit) {
    const match = [defaultLocale, ...availableLocales].find(
      (l) => l.toLowerCase() === explicit.toLowerCase()
    );
    if (match) return match;
  }

  return defaultLocale;
}

// Multilingual SEO audit (2026-08-31), fix M2 — RTL scripts need
// `<html dir="rtl">`, not just `lang`. Covers the right-to-left languages
// plus any code that explicitly names an RTL script subtag
// ("az-Arab", "ku-Arab", …).
const RTL_LANGS = new Set([
  "ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb", "ku", "arc", "nqo", "prd", "syr",
]);

export function isRtlLocale(code: string): boolean {
  const lower = code.toLowerCase();
  if (RTL_LANGS.has(lower.split("-")[0])) return true;
  return /-(arab|hebr|thaa|syrc|nkoo|yezi|adlm)\b/.test(lower);
}

// Header translation follow-up to Phase 24 (menu labels, page titles,
// custom-link labels) — set via vibemeasite-mcp's set_header_translations
// tool, stored as a plain { [lang]: string } JSONB column/field alongside
// the default-language value. Same locales[lang] ?? root fallback
// convention used everywhere else in this feature. `translations` is
// `unknown` because it comes straight off a jsonb column with no runtime
// shape guarantee.
export function resolveTranslation(defaultValue: string, translations: unknown, locale: string): string {
  if (!translations || typeof translations !== "object") return defaultValue;
  const value = (translations as Record<string, unknown>)[locale];
  return typeof value === "string" && value.length > 0 ? value : defaultValue;
}
