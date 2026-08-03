import { headers } from "next/headers";

// Phase 24 (Cellpy platform) — reads the language middleware.ts resolved
// from ?lang= / the cellpy_lang cookie, falling back to the site's
// configured default. Callable from any server component (layout.tsx,
// SitePage.tsx) since next/headers `headers()` — unlike searchParams —
// is available in layouts too.
export async function getCurrentLocale(defaultLocale: string): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("x-cellpy-lang") || defaultLocale;
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
