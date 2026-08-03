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
