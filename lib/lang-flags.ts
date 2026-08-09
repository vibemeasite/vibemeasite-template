// Header language switcher flags (follow-up to Phase 24) — a fixed
// code -> flag-emoji lookup, not derived algorithmically from the code: a
// bare 2-letter language code has no single reliable country (e.g. "en"
// could be GB/US/AU), so guessing would be wrong as often as not. A code
// with no entry here falls back to a plain globe icon instead.
const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", uk: "🇺🇦", pl: "🇵🇱", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹",
  pt: "🇵🇹", ru: "🇷🇺", nl: "🇳🇱", sv: "🇸🇪", no: "🇳🇴", da: "🇩🇰", fi: "🇫🇮",
  cs: "🇨🇿", sk: "🇸🇰", hu: "🇭🇺", ro: "🇷🇴", bg: "🇧🇬", el: "🇬🇷", tr: "🇹🇷",
  ar: "🇸🇦", he: "🇮🇱", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", hi: "🇮🇳", th: "🇹🇭",
  vi: "🇻🇳", id: "🇮🇩", ms: "🇲🇾", ka: "🇬🇪", hy: "🇦🇲", az: "🇦🇿", lt: "🇱🇹",
  lv: "🇱🇻", et: "🇪🇪", hr: "🇭🇷", sr: "🇷🇸", sl: "🇸🇮",
};
const FALLBACK_FLAG = "🌐";

export function flagForLocale(code: string): string {
  return LANG_FLAGS[code.toLowerCase()] ?? FALLBACK_FLAG;
}
