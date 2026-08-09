// Header language switcher flags (follow-up to Phase 24) — a fixed
// language-code -> country-code lookup, not derived algorithmically from
// the code: a bare 2-letter language code has no single reliable country
// (e.g. "en" could be GB/US/AU), so guessing would be wrong as often as
// not. A code with no entry here falls back to a plain globe icon instead.
//
// Originally used flag emoji, but Windows' system emoji font has no flag
// glyphs at all (renders the two-letter regional-indicator fallback
// instead, e.g. "IL" instead of 🇮🇱) — real flag pictures need actual
// image assets, so this now points at the SVGs in public/flags/ (sourced
// from vibemeasite/docs/svg) instead.
const LANG_COUNTRY: Record<string, string> = {
  en: "gb", uk: "ua", pl: "pl", de: "de", fr: "fr", es: "es", it: "it",
  pt: "pt", ru: "ru", nl: "nl", sv: "se", no: "no", da: "dk", fi: "fi",
  cs: "cz", sk: "sk", hu: "hu", ro: "ro", bg: "bg", el: "gr", tr: "tr",
  ar: "sa", he: "il", ja: "jp", ko: "kr", zh: "cn", hi: "in", th: "th",
  vi: "vn", id: "id", ms: "my", ka: "ge", hy: "am", az: "az", lt: "lt",
  lv: "lv", et: "ee", hr: "hr", sr: "rs", sl: "si",
};
const FALLBACK_FLAG_SRC = "/flags/_globe.svg";

export function flagSrcForLocale(code: string): string {
  const country = LANG_COUNTRY[code.toLowerCase()];
  return country ? `/flags/${country}.svg` : FALLBACK_FLAG_SRC;
}
