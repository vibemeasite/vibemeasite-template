// BSA Phase 27 (US-VMAS-TRAVEL-07) — pure month-grid math for the trip
// calendar. Dates are "YYYY-MM-DD" strings (already converted to each trip's
// own timezone by the caller), so nothing here depends on the server's zone.

export interface DaySpan {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
}

export interface CalendarBar {
  index: number; // into the spans array
  col: number; // 1..7
  span: number; // columns
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface CalendarWeek {
  days: Array<{ date: string; inMonth: boolean }>;
  bars: CalendarBar[];
}

const DAY = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function parseMonthParam(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return null;
  const y = Number(v.slice(0, 4));
  return y >= 2000 && y <= 2100 ? v : null;
}

// ISO weekday the week starts on (1 = Monday … 7 = Sunday), from the locale's
// own week data where the runtime has it.
export function weekStartFor(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay && info.firstDay >= 1 && info.firstDay <= 7) return info.firstDay;
  } catch {
    /* fall through */
  }
  return /^en(-US)?$/i.test(locale) ? 7 : 1;
}

// ISO weekday (1 = Mon … 7 = Sun) of a UTC midnight.
function isoDay(ms: number): number {
  const d = new Date(ms).getUTCDay();
  return d === 0 ? 7 : d;
}

export function buildMonthWeeks(key: string, weekStart: number, spans: DaySpan[]): CalendarWeek[] {
  const first = toUtc(`${key}-01`);
  const nextMonth = toUtc(`${shiftMonth(key, 1)}-01`);
  const last = nextMonth - DAY;
  const lead = (isoDay(first) - weekStart + 7) % 7;
  const gridStart = first - lead * DAY;
  const weeks: CalendarWeek[] = [];
  for (let ws = gridStart; ws <= last; ws += 7 * DAY) {
    const we = ws + 6 * DAY;
    const days = Array.from({ length: 7 }, (_, i) => {
      const ms = ws + i * DAY;
      return { date: fromUtc(ms), inMonth: ms >= first && ms <= last };
    });
    const bars: CalendarBar[] = [];
    spans.forEach((s, index) => {
      const a = toUtc(s.start), b = Math.max(toUtc(s.end), a);
      if (b < ws || a > we) return;
      const from = Math.max(a, ws), to = Math.min(b, we);
      bars.push({
        index,
        col: Math.round((from - ws) / DAY) + 1,
        span: Math.round((to - from) / DAY) + 1,
        continuesBefore: a < ws,
        continuesAfter: b > we,
      });
    });
    weeks.push({ days, bars });
  }
  return weeks;
}
