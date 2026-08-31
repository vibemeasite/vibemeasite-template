// Multilingual SEO audit (2026-08-31), fix H2 — Open Graph's `og:locale`
// wants an underscore `language_TERRITORY` value (e.g. "fr_FR", "pt_BR"),
// not the bare BCP-47 language tag the rest of this template uses for
// <html lang> / hreflang. This maps the site's locale codes to a
// reasonable OG value:
//
//   - a code that already carries a region ("zh-CN", "pt-BR") just swaps
//     "-" for "_"  ->  "zh_CN", "pt_BR"
//   - a bare language code gets its most common territory from the table
//     below  ->  "fr" -> "fr_FR", "ja" -> "ja_JP"
//   - anything unknown falls back to doubling the subtag  ->  "xx" ->
//     "xx_XX" (harmless; crawlers that don't recognise it just ignore it)
//
// This is a hint, not a targeting directive — see the audit notes on why
// the site deliberately uses language-only, not country, targeting.
const DEFAULT_TERRITORY: Record<string, string> = {
  en: "US", ar: "AR", bn: "BD", cs: "CZ", da: "DK", de: "DE", el: "GR",
  es: "ES", fa: "IR", fi: "FI", fr: "FR", he: "IL", hi: "IN", hu: "HU",
  id: "ID", it: "IT", ja: "JP", ko: "KR", mr: "IN", ms: "MY", nb: "NO",
  no: "NO", nl: "NL", pa: "IN", pl: "PL", pt: "PT", ro: "RO", ru: "RU",
  sv: "SE", ta: "IN", te: "IN", th: "TH", tl: "PH", fil: "PH", tr: "TR",
  uk: "UA", vi: "VN", zh: "CN",
};

export function ogLocale(code: string): string {
  const parts = code.split("-");
  if (parts.length > 1) {
    // "zh-CN" -> "zh_CN", "zh-Hans" -> "zh_Hans" (fine for OG)
    return `${parts[0].toLowerCase()}_${parts.slice(1).join("_")}`;
  }
  const lang = parts[0].toLowerCase();
  const territory = DEFAULT_TERRITORY[lang] ?? lang.toUpperCase();
  return `${lang}_${territory}`;
}
