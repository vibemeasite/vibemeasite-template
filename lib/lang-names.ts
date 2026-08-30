// Header language switcher labels (follow-up to the flags feature in
// lib/lang-flags.ts). site_settings.lang_switcher_labels — set via
// vibemeasite-mcp's set_language_switcher_style — picks how each language
// is written in the "select" switcher:
//
//   "code"           → "EN"          (the original behavior, code.toUpperCase())
//   "native"         → "Español"     (the language's own name — an autonym)
//   "native_english" → "Español (Spanish)"  (autonym + English name — the
//                      LinkedIn-style label)
//
// Only the "select" presentation reads this; "buttons" always stays a
// short uppercase code (long names don't fit a header link row), same
// scoping as langSwitcherFlags.
//
// A small curated table is consulted FIRST, for two reasons: (1) it lets
// us control casing (ICU's Intl.DisplayNames returns lowercase autonyms
// for many languages — "español", "français" — where the switcher wants
// "Español", "Français") and phrasing, and (2) it guarantees byte-identical
// output between the Node server render and the browser client render
// (MobileNav is a client component), since full-ICU builds can disagree on
// the long tail ("Chinese, Simplified" vs "Simplified Chinese"). Anything
// not in the table falls back to Intl.DisplayNames, and finally to the
// bare uppercase code if that throws or returns the input unchanged.

interface LangName {
  native: string;
  english: string;
}

// Keyed by the lowercased locale code. Region-qualified codes (en-US,
// pt-BR, zh-Hans, ...) are looked up whole first, then by their base
// language subtag — so "es-MX" resolves through "es" unless it has its
// own entry.
const NAMES: Record<string, LangName> = {
  en: { native: "English", english: "English" },
  es: { native: "Español", english: "Spanish" },
  fr: { native: "Français", english: "French" },
  de: { native: "Deutsch", english: "German" },
  it: { native: "Italiano", english: "Italian" },
  pt: { native: "Português", english: "Portuguese" },
  "pt-br": { native: "Português (Brasil)", english: "Portuguese (Brazil)" },
  nl: { native: "Nederlands", english: "Dutch" },
  pl: { native: "Polski", english: "Polish" },
  ru: { native: "Русский", english: "Russian" },
  uk: { native: "Українська", english: "Ukrainian" },
  cs: { native: "Čeština", english: "Czech" },
  sk: { native: "Slovenčina", english: "Slovak" },
  sv: { native: "Svenska", english: "Swedish" },
  no: { native: "Norsk", english: "Norwegian" },
  nb: { native: "Norsk bokmål", english: "Norwegian Bokmål" },
  da: { native: "Dansk", english: "Danish" },
  fi: { native: "Suomi", english: "Finnish" },
  el: { native: "Ελληνικά", english: "Greek" },
  tr: { native: "Türkçe", english: "Turkish" },
  hu: { native: "Magyar", english: "Hungarian" },
  ro: { native: "Română", english: "Romanian" },
  bg: { native: "Български", english: "Bulgarian" },
  hr: { native: "Hrvatski", english: "Croatian" },
  sr: { native: "Српски", english: "Serbian" },
  sl: { native: "Slovenščina", english: "Slovenian" },
  et: { native: "Eesti", english: "Estonian" },
  lv: { native: "Latviešu", english: "Latvian" },
  lt: { native: "Lietuvių", english: "Lithuanian" },
  is: { native: "Íslenska", english: "Icelandic" },
  ga: { native: "Gaeilge", english: "Irish" },
  cy: { native: "Cymraeg", english: "Welsh" },
  ca: { native: "Català", english: "Catalan" },
  eu: { native: "Euskara", english: "Basque" },
  gl: { native: "Galego", english: "Galician" },
  af: { native: "Afrikaans", english: "Afrikaans" },
  sw: { native: "Kiswahili", english: "Swahili" },
  ar: { native: "العربية", english: "Arabic" },
  he: { native: "עברית", english: "Hebrew" },
  fa: { native: "فارسی", english: "Persian" },
  ur: { native: "اردو", english: "Urdu" },
  hi: { native: "हिन्दी", english: "Hindi" },
  bn: { native: "বাংলা", english: "Bengali" },
  ta: { native: "தமிழ்", english: "Tamil" },
  te: { native: "తెలుగు", english: "Telugu" },
  mr: { native: "मराठी", english: "Marathi" },
  th: { native: "ไทย", english: "Thai" },
  vi: { native: "Tiếng Việt", english: "Vietnamese" },
  id: { native: "Bahasa Indonesia", english: "Indonesian" },
  ms: { native: "Bahasa Melayu", english: "Malay" },
  fil: { native: "Filipino", english: "Filipino" },
  tl: { native: "Tagalog", english: "Tagalog" },
  ja: { native: "日本語", english: "Japanese" },
  ko: { native: "한국어", english: "Korean" },
  zh: { native: "中文", english: "Chinese" },
  "zh-cn": { native: "简体中文", english: "Chinese (Simplified)" },
  "zh-hans": { native: "简体中文", english: "Chinese (Simplified)" },
  "zh-tw": { native: "繁體中文", english: "Chinese (Traditional)" },
  "zh-hant": { native: "繁體中文", english: "Chinese (Traditional)" },
  ka: { native: "ქართული", english: "Georgian" },
  hy: { native: "Հայերեն", english: "Armenian" },
  az: { native: "Azərbaycan", english: "Azerbaijani" },
  kk: { native: "Қазақша", english: "Kazakh" },
  uz: { native: "Oʻzbek", english: "Uzbek" },
};

export type LangLabelStyle = "code" | "native" | "native_english";

function capitalizeFirst(s: string): string {
  if (!s) return s;
  const first = s[0].toLocaleUpperCase();
  return first + s.slice(1);
}

// Best-effort ICU lookup for codes not in NAMES. `inLocale` = which
// language the name is rendered in (the code itself for the autonym,
// "en" for the English name). Returns null when ICU is unavailable, the
// input is echoed back unchanged, or anything throws.
function displayName(code: string, inLocale: string): string | null {
  try {
    const dn = new Intl.DisplayNames([inLocale], { type: "language" });
    const out = dn.of(code);
    if (!out || out.toLowerCase() === code.toLowerCase()) return null;
    return out;
  } catch {
    return null;
  }
}

function lookup(code: string): LangName | null {
  const normalized = code.toLowerCase();
  if (NAMES[normalized]) return NAMES[normalized];
  const base = normalized.split("-")[0];
  if (NAMES[base]) return NAMES[base];

  const native = displayName(code, code);
  const english = displayName(code, "en");
  if (!native && !english) return null;
  return {
    native: capitalizeFirst(native ?? english ?? code),
    english: english ?? capitalizeFirst(native ?? code),
  };
}

// The single entry point MobileNav calls per language. Falls back to the
// uppercase code for anything unresolvable, so the switcher never renders
// a blank option.
export function langLabel(code: string, style: LangLabelStyle): string {
  if (style === "code") return code.toUpperCase();

  const name = lookup(code);
  if (!name) return code.toUpperCase();

  if (style === "native") return name.native;

  // native_english — collapse to just the native name when the two are
  // identical (English shown in English, etc.) so it doesn't read
  // "English (English)".
  if (name.native.toLowerCase() === name.english.toLowerCase()) return name.native;
  return `${name.native} (${name.english})`;
}
