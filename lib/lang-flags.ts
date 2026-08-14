// Header language switcher flags (follow-up to Phase 24). Two lookup paths:
//
//  1. A region subtag on the locale itself (e.g. "en-US", "en-CA", "en-AU",
//     "es-MX", "es-AR", "fr-CA", "pt-BR") maps directly to that country's
//     flag. This is how US/Canada/Australia/Latin America/etc. show up
//     correctly — a bare language code alone can't distinguish them (see
//     #2), so a multi-country site should declare its languages with a
//     region subtag when the specific country matters (e.g. create_site's
//     `languages` array can use "en-US"/"en-CA" instead of just "en").
//  2. A bare language code (e.g. "en", "es") falls back to one
//     representative country per language (BARE_LANG_COUNTRY below) —
//     necessarily a single arbitrary choice, since "en" alone doesn't say
//     which of GB/US/AU/CA/... the site means.
//
// A code that resolves to neither (region not in FLAG_COUNTRIES, no bare
// -language entry) falls back to a plain globe icon rather than guessing.
// Originally used flag emoji, but Windows' system emoji font has no flag
// glyphs at all (renders the two-letter regional-indicator fallback
// instead, e.g. "IL" instead of 🇮🇱) — real flag pictures need actual
// image assets.
//
// All 251 country flags live as <symbol id="{cc}"> entries split across
// several sprite files under public/flags/ (sourced from
// vibemeasite/docs/svg, built by combining the original one-file-per-
// country set) — NOT as 251 individual files. upgrade_site_template's
// fetchTemplateFiles fetches every file in the template repo individually
// (one GitHub request per file); 251 separate flag files pushed that past
// whatever concurrency/rate limit made upgrades reliable, so they're
// combined into sprites. A single 3.7MB sprite.svg (all 251 in one file)
// turned out to break the *other* direction: deployTemplateFiles uploads
// every file inline in one deployment request, and that single file was
// silently dropped/kept-stale on every deploy once it got that large,
// while every other (small) file updated fine — see the bugfix commit
// that split it. So flags are bucketed instead: sprite-common.svg (the
// ~47 flags BARE_LANG_COUNTRY/region defaults actually use, plus _globe)
// and sprite-rest-{1..8}.svg (everything else, size-bounded to ~500KB
// each, in alphabetical id ranges — see flagSpriteFile below). Callers
// render `<svg><use href={\`${flagSpriteFile(id)}#${id}\`} /></svg>` (see
// MobileNav.tsx) — a real <select><option> can't hold this at all, which
// is also why the "select" presentation is a custom listbox, not a native
// <select> (see MobileNav.tsx's own comment).
const FLAG_COUNTRIES = new Set([
  "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "aq", "ar", "as", "at", "au", "aw", "ax",
  "az", "ba", "bb", "bd", "be", "bf", "bg", "bh", "bi", "bj", "bl", "bm", "bn", "bo", "bq",
  "br", "bs", "bt", "bv", "bw", "by", "bz", "ca", "cc", "cd", "cf", "cg", "ch", "ci", "ck",
  "cl", "cm", "cn", "co", "cr", "cu", "cv", "cw", "cx", "cy", "cz", "de", "dj", "dk", "dm",
  "do", "dz", "ec", "ee", "eg", "eh", "er", "es", "et", "fi", "fj", "fk", "fm", "fo", "fr",
  "ga", "gb", "gd", "ge", "gf", "gg", "gh", "gi", "gl", "gm", "gn", "gp", "gq", "gr", "gs",
  "gt", "gu", "gw", "gy", "hk", "hm", "hn", "hr", "ht", "hu", "id", "ie", "il", "im", "in",
  "io", "iq", "ir", "is", "it", "je", "jm", "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn",
  "kp", "kr", "kw", "ky", "kz", "la", "lb", "lc", "li", "lk", "lr", "ls", "lt", "lu", "lv",
  "ly", "ma", "mc", "md", "me", "mf", "mg", "mh", "mk", "ml", "mm", "mn", "mo", "mp", "mq",
  "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz", "na", "nc", "ne", "nf", "ng", "ni",
  "nl", "no", "np", "nr", "nu", "nz", "om", "pa", "pe", "pf", "pg", "ph", "pk", "pl", "pm",
  "pn", "pr", "ps", "pt", "pw", "py", "qa", "re", "ro", "rs", "ru", "rw", "sa", "sb", "sc",
  "sd", "se", "sg", "sh", "si", "sj", "sk", "sl", "sm", "sn", "so", "sr", "ss", "st", "sv",
  "sx", "sy", "sz", "tc", "td", "tf", "tg", "th", "tj", "tk", "tl", "tm", "tn", "to", "tr",
  "tt", "tv", "tw", "tz", "ua", "ug", "um", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi",
  "vn", "vu", "wf", "ws", "xk", "ye", "yt", "za", "zm", "zw",
]);

// One representative country per bare language code — used only when the
// declared locale has no region subtag of its own. Deliberately narrower
// than FLAG_COUNTRIES: every one of these languages also has plenty of
// other valid countries (en: US/CA/AU/...; es: MX/AR/CO/...; fr: CA/BE/...;
// pt: BR/...) that a region-qualified code (see file comment) picks
// instead of this default.
const BARE_LANG_COUNTRY: Record<string, string> = {
  en: "gb", uk: "ua", pl: "pl", de: "de", fr: "fr", es: "es", it: "it",
  pt: "pt", ru: "ru", nl: "nl", sv: "se", no: "no", da: "dk", fi: "fi",
  cs: "cz", sk: "sk", hu: "hu", ro: "ro", bg: "bg", el: "gr", tr: "tr",
  ar: "sa", he: "il", ja: "jp", ko: "kr", zh: "cn", hi: "in", th: "th",
  vi: "vn", id: "id", ms: "my", ka: "ge", hy: "am", az: "az", lt: "lt",
  lv: "lv", et: "ee", hr: "hr", sr: "rs", sl: "si",
};
const FALLBACK_SYMBOL_ID = "_globe";

// Returns a <symbol id> — see flagSpriteFile for which sprite file it
// actually lives in.
export function flagSymbolForLocale(code: string): string {
  const normalized = code.toLowerCase();
  const region = normalized.split("-")[1];
  if (region && FLAG_COUNTRIES.has(region)) return region;

  const bareLang = normalized.split("-")[0];
  return BARE_LANG_COUNTRY[bareLang] ?? FALLBACK_SYMBOL_ID;
}

// Every id a bare-language default or a documented common region example
// resolves to (BARE_LANG_COUNTRY's values, plus us/ca/au/mx/ar/br from the
// file-comment examples), plus the globe fallback — kept in
// sprite-common.svg so the overwhelmingly common case is one small file.
const COMMON_SPRITE_IDS = new Set([
  ...Object.values(BARE_LANG_COUNTRY),
  "us", "ca", "au", "mx", "ar", "br",
  FALLBACK_SYMBOL_ID,
]);

// Everything else lives in sprite-rest-{1..8}.svg, bucketed by size
// (~500KB/file) in alphabetical-id order — each entry is the last id
// (inclusive) of its bucket, generated from the same alphabetical split
// used to build the files, so this only needs to list where each bucket
// ends rather than every id in it.
const REST_SPRITE_BUCKET_END: Array<[end: string, file: number]> = [
  ["bn", 1], ["dm", 2], ["fj", 3], ["kh", 4], ["nz", 5], ["st", 6], ["ye", 7], ["zw", 8],
];

// Returns the sprite file path (relative to public/) a given symbol id
// lives in, for `<use href={\`${flagSpriteFile(id)}#${id}\`} />`.
export function flagSpriteFile(symbolId: string): string {
  if (COMMON_SPRITE_IDS.has(symbolId)) return "/flags/sprite-common.svg";
  const bucket = REST_SPRITE_BUCKET_END.find(([end]) => symbolId <= end);
  return `/flags/sprite-rest-${bucket ? bucket[1] : REST_SPRITE_BUCKET_END.length}.svg`;
}
