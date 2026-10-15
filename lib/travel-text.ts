// BSA Phase 27 — Travel Kit text helpers (pure; unit-tested).

export type TripStatus = "upcoming" | "in_progress" | "past" | "cancelled";

export function tripStatus(
  t: { startAt: Date | string; endAt: Date | string; cancelledAt?: Date | string | null },
  now = Date.now(),
): TripStatus {
  if (t.cancelledAt) return "cancelled";
  const start = new Date(t.startAt).getTime();
  const end = new Date(t.endAt).getTime();
  if (now < start) return "upcoming";
  if (now <= end) return "in_progress";
  return "past";
}

// Visitor locale → site default → any language (dev-steps Decision 2).
export function resolveText<T>(byLang: Record<string, T>, locale: string, defaultLocale: string): T | undefined {
  return byLang[locale] ?? byLang[defaultLocale] ?? Object.values(byLang)[0];
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

// Owner-written place/trip text → safe HTML (rendered with
// dangerouslySetInnerHTML, so this is the only gate). Allowed markup:
// <strong>/<b>, <em>/<i>, <br>, <a href> to http(s)/mailto. Everything else
// is escaped as text. Blank-line-separated paragraphs become <p>; single
// newlines become <br>. Unclosed tags are closed at the end of their paragraph.
export function travelTextToHtml(input: string | null | undefined): string {
  const text = (input ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const TOKEN_RE = /<(\/?)(strong|b|em|i)\s*>|<br\s*\/?>|<a\s+href\s*=\s*"([^"]*)"\s*>|<\/a\s*>/gi;
  const renderInline = (chunk: string): string => {
    let out = "";
    let last = 0;
    const open: string[] = [];
    const closeTo = (tag: string) => {
      const idx = open.lastIndexOf(tag);
      if (idx === -1) return;
      while (open.length > idx) out += `</${open.pop()}>`;
    };
    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(chunk)) !== null) {
      out += escapeHtml(chunk.slice(last, m.index)).replace(/\n/g, "<br>");
      last = m.index + m[0].length;
      const tok = m[0].toLowerCase();
      if (tok.startsWith("<br")) {
        out += "<br>";
      } else if (m[2]) {
        const raw = m[2].toLowerCase();
        const tag = raw === "b" ? "strong" : raw === "i" ? "em" : raw;
        if (m[1]) closeTo(tag);
        else {
          open.push(tag);
          out += `<${tag}>`;
        }
      } else if (m[3] !== undefined) {
        const href = m[3].trim();
        if (/^(https?:\/\/|mailto:)/i.test(href)) {
          open.push("a");
          out += `<a href="${escapeHtml(href)}" rel="noopener" target="_blank">`;
        }
      } else if (tok.startsWith("</a")) {
        closeTo("a");
      }
    }
    out += escapeHtml(chunk.slice(last)).replace(/\n/g, "<br>");
    while (open.length) out += `</${open.pop()}>`;
    return out;
  };
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${renderInline(p)}</p>`)
    .join("");
}

// Only https images or same-site paths reach an <img src> / CSS url().
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Book button target: a same-site path, https, or mailto.
export function safeLinkUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const p = new URL(url).protocol;
    return p === "https:" || p === "mailto:" ? url : null;
  } catch {
    return null;
  }
}

// "14–16 Nov 2026" / "30 Nov – 2 Dec 2026" / "14 Nov 2026, 07:30" style ranges
// in the trip's own timezone and the visitor's locale.
export function formatTripDates(startAt: Date | string, endAt: Date | string, timeZone: string, locale: string): string {
  const start = new Date(startAt), end = new Date(endAt);
  try {
    const fmt = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" });
    const sameDay = ymd(start, timeZone) === ymd(end, timeZone);
    if (sameDay) return fmt.format(start);
    return fmt.formatRange(start, end);
  } catch {
    return `${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)}`;
  }
}

export function formatTime(at: Date | string, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(11, 16);
  }
}

export function formatDayTime(at: Date | string, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(0, 16).replace("T", " ");
  }
}

// "YYYY-MM-DD" of an instant on the wall clock in timeZone.
export function ymd(at: Date | string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

export function formatDuration(min: number, locale: string): string {
  const h = Math.floor(min / 60), m = min % 60;
  try {
    const parts: string[] = [];
    if (h) parts.push(new Intl.NumberFormat(locale, { style: "unit", unit: "hour", unitDisplay: "short" }).format(h));
    if (m || !h) parts.push(new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "short" }).format(m));
    return parts.join(" ");
  } catch {
    return h ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${m} min`;
  }
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
