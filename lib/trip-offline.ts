// BSA Phase 27 (slice 3) — shared by the trip page and the offline manifest,
// so the audio URLs the page renders are byte-for-byte the cache keys the
// offline bundle stores (the service worker matches by URL).

export function tripAudioSrc(tripSlug: string, placeSlug: string, lang: string, version: string): string {
  return `/api/trips/audio?trip=${encodeURIComponent(tripSlug)}&place=${encodeURIComponent(placeSlug)}&lang=${encodeURIComponent(lang)}&v=${version}`;
}

// "/trips/x" for the default locale, "/{locale}/trips/x" for the others
// (path-prefix i18n, see lib/locale.ts).
export function tripPagePath(pageSlug: string, locale: string, defaultLocale: string): string {
  return locale === defaultLocale ? `/${pageSlug}` : `/${locale}/${pageSlug}`;
}
