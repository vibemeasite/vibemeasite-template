import { headers } from "next/headers";

// Phase 13 (VibeMeASite), US-VMAS-LOCALE-01 — parses a raw Accept-Language
// header value ("uk-UA,uk;q=0.9,en;q=0.8") against the site's declared
// languages. Checked in header order (the browser's own preference order,
// q-values included via that same order); exact tag match ("pt-BR") is
// tried before a primary-subtag match ("pt") for the tag that follows it,
// so a site that happens to declare the specific regional variant is
// preferred over a same-primary-subtag fallback declared elsewhere in the
// header. Returns null (not defaultLocale) on no match, so the caller's own
// defaulting logic stays the single place that decision is made.
function matchAcceptLanguage(headerValue: string, availableLocales: string[]): string | null {
  const available = new Set(availableLocales.map((l) => l.toLowerCase()));
  const tags = headerValue
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);

  for (const tag of tags) {
    if (available.has(tag)) return availableLocales[[...available].indexOf(tag)];
  }
  for (const tag of tags) {
    const primary = tag.split("-")[0];
    const match = availableLocales.find((l) => l.toLowerCase() === primary || l.toLowerCase().split("-")[0] === primary);
    if (match) return match;
  }
  return null;
}

// Phase 24 (Cellpy platform) — reads the language middleware.ts resolved
// from ?lang= / the cellpy_lang cookie, falling back to the site's
// configured default. Callable from any server component (layout.tsx,
// SitePage.tsx) since next/headers `headers()` — unlike searchParams —
// is available in layouts too.
//
// Phase 13 (VibeMeASite), US-VMAS-LOCALE-01 — when no explicit choice
// exists (no ?lang= this request, no cellpy_lang cookie ever set), falls
// back to the visitor's browser Accept-Language before the site's own
// default. Decided as a SILENT default, not a redirect: this only changes
// what renders on the current URL, it never navigates the visitor anywhere
// or sets cellpy_lang itself — a returning visitor, or anyone who has ever
// used the language switcher, is unaffected, since an explicit ?lang=/
// cookie choice (read via x-cellpy-lang) always wins first. availableLocales
// defaults to [] so every pre-existing call site keeps compiling and
// behaving identically until it's updated to pass the site's real list.
export async function getCurrentLocale(defaultLocale: string, availableLocales: string[] = []): Promise<string> {
  const hdrs = await headers();
  const explicit = hdrs.get("x-cellpy-lang");
  if (explicit) return explicit;

  if (availableLocales.length > 1) {
    const acceptLanguage = hdrs.get("accept-language");
    if (acceptLanguage) {
      const detected = matchAcceptLanguage(acceptLanguage, availableLocales);
      if (detected) return detected;
    }
  }

  return defaultLocale;
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
