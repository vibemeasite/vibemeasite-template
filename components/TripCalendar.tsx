import { getCalendarTrips, type CalendarTrip } from "../lib/travel-query";
import { tripStatus, resolveText, safeImageUrl, safeLinkUrl, formatTripDates, ymd, type TripStatus } from "../lib/travel-text";
import { travelStrings, type TravelStrings } from "../lib/travel-i18n";
import type { SearchParamsRecord } from "../lib/entries-query";
import { buildMonthWeeks, shiftMonth, parseMonthParam, weekStartFor, type DaySpan } from "../lib/trip-calendar";

// BSA Phase 27 (US-VMAS-TRAVEL-07) — every trip, past and upcoming, rendered
// where a block carries <div data-trip-calendar> (components/CellpyBlock.tsx).
// Zero client JS (dev-steps Decision 4): ?cal=YYYY-MM picks the first month,
// ?calview=month|list the view; prev/next/today are plain links. The list is
// always rendered too — it's what phones (<640px) see in month view, via CSS.

interface Props {
  view: "month" | "list";
  months: number;
  searchParams: SearchParamsRecord;
  locale: string;
  defaultLocale: string;
}

interface Item {
  trip: CalendarTrip;
  status: TripStatus;
  title: string;
  href: string;
  span: DaySpan;
}

function hrefWith(sp: SearchParamsRecord, patch: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in patch) continue;
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
  }
  for (const [k, v] of Object.entries(patch)) if (v !== null) q.set(k, v);
  const s = q.toString();
  return `${s ? `?${s}` : "?"}#trip-calendar`;
}

function statusText(s: TripStatus, t: TravelStrings): string {
  return s === "upcoming" ? t.upcoming : s === "in_progress" ? t.now : s === "past" ? t.past : t.cancelled;
}

// The calendar's own "today": the zone most trips use (an agency normally runs
// from one place), else UTC.
function calendarZone(trips: CalendarTrip[]): string {
  const counts = new Map<string, number>();
  for (const t of trips) counts.set(t.timezone, (counts.get(t.timezone) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UTC";
}

export async function TripCalendar({ view: markerView, months, searchParams, locale, defaultLocale }: Props) {
  const t = travelStrings(locale);
  const trips = await getCalendarTrips();
  const now = Date.now();
  const zone = calendarZone(trips);
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  const rawView = typeof searchParams.calview === "string" ? searchParams.calview : undefined;
  const view = rawView === "list" || rawView === "month" ? rawView : markerView;
  const todayKey = ymd(new Date(now), zone).slice(0, 7);
  const first = parseMonthParam(searchParams.cal) ?? todayKey;
  const monthCount = Math.min(Math.max(months, 1), 6);
  const monthKeys = Array.from({ length: monthCount }, (_, i) => shiftMonth(first, i));
  const weekStart = weekStartFor(locale);

  const items: Item[] = trips.map((trip) => {
    const txt = resolveText(trip.text, locale, defaultLocale);
    return {
      trip,
      status: tripStatus(trip, now),
      title: txt?.title ?? trip.slug,
      href: `${prefix}/${trip.pageSlug}`,
      span: { start: ymd(trip.startAt, trip.timezone), end: ymd(trip.endAt, trip.timezone) },
    };
  });

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdayNames = Array.from({ length: 7 }, (_, i) => dayFmt.format(new Date(Date.UTC(2024, 0, 1 + ((weekStart - 1 + i) % 7)))));
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
  };

  const upcoming = items.filter((i) => i.status === "upcoming" || i.status === "in_progress" || (i.status === "cancelled" && Date.parse(i.trip.endAt) >= now));
  const past = items.filter((i) => !upcoming.includes(i)).reverse();

  const card = (i: Item) => {
    const cover = safeImageUrl(i.trip.coverImage);
    const book = (i.status === "upcoming" || i.status === "in_progress") ? safeLinkUrl(i.trip.bookUrl) : null;
    const bookHref = book && book.startsWith("/") && !book.startsWith("//") ? `${prefix}${book}` : book;
    const summary = resolveText(i.trip.text, locale, defaultLocale)?.summary;
    return (
      <li key={i.trip.slug} className={`vms-cal-card is-${i.status}`}>
        <a className="vms-cal-card__link" href={i.href}>
          {cover ? <img className="vms-cal-card__img" src={cover} alt="" loading="lazy" /> : <span className="vms-cal-card__img vms-cal-card__img--empty" aria-hidden="true" />}
          <span className="vms-cal-card__body">
            <span className={`vms-trip-badge vms-trip-badge--${i.status}`}>{statusText(i.status, t)}</span>
            <span className="vms-cal-card__title">{i.title}</span>
            <span className="vms-cal-card__dates">{formatTripDates(i.trip.startAt, i.trip.endAt, i.trip.timezone, locale)}</span>
            {i.status === "past" && <span className="vms-cal-card__past">{t.pastCta}</span>}
            {summary && i.status !== "past" && <span className="vms-cal-card__summary">{summary.replace(/<[^>]*>/g, "").slice(0, 160)}</span>}
          </span>
        </a>
        {bookHref && <a className="vms-cal-card__book" href={bookHref}>{t.book}</a>}
      </li>
    );
  };

  const list = (
    <div className="vms-cal-list">
      {items.length === 0 && <p className="vms-cal-empty">{t.noTrips}</p>}
      {upcoming.length > 0 && (
        <section>
          <h3 className="vms-cal-list__h">{t.upcoming}</h3>
          <ul className="vms-cal-cards">{upcoming.map(card)}</ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h3 className="vms-cal-list__h">{t.past}</h3>
          <ul className="vms-cal-cards">{past.map(card)}</ul>
        </section>
      )}
    </div>
  );

  return (
    <div id="trip-calendar" className={`vms-cal vms-cal--${view}`} aria-label={t.calendar}>
      <nav className="vms-cal__bar" aria-label={t.calendar}>
        {view === "month" && (
          <span className="vms-cal__nav">
            <a className="vms-cal__btn" href={hrefWith(searchParams, { cal: shiftMonth(first, -1) })} aria-label={t.prev}>‹</a>
            <a className="vms-cal__btn" href={hrefWith(searchParams, { cal: null })} aria-current={first === todayKey ? "true" : undefined}>{t.today}</a>
            <a className="vms-cal__btn" href={hrefWith(searchParams, { cal: shiftMonth(first, 1) })} aria-label={t.next}>›</a>
          </span>
        )}
        <span className="vms-cal__views">
          <a className="vms-cal__btn" href={hrefWith(searchParams, { calview: "month" })} aria-current={view === "month" ? "true" : undefined}>{t.monthView}</a>
          <a className="vms-cal__btn" href={hrefWith(searchParams, { calview: "list" })} aria-current={view === "list" ? "true" : undefined}>{t.listView}</a>
        </span>
      </nav>

      {view === "month" && (
        <div className="vms-cal__months">
          {monthKeys.map((key) => {
            const weeks = buildMonthWeeks(key, weekStart, items.map((i) => i.span));
            return (
              <section key={key} className="vms-cal-month">
                <h3 className="vms-cal-month__title">{monthLabel(key)}</h3>
                <div className="vms-cal-month__head" aria-hidden="true">
                  {weekdayNames.map((n, i) => <span key={i}>{n}</span>)}
                </div>
                {weeks.map((w, wi) => (
                  <div key={wi} className="vms-cal-week">
                    {w.days.map((d, di) => (
                      <span
                        key={d.date}
                        className={`vms-cal-day${d.inMonth ? "" : " is-out"}${d.date === ymd(new Date(now), zone) ? " is-today" : ""}`}
                        style={{ gridColumn: di + 1 }}
                      >
                        {Number(d.date.slice(8))}
                      </span>
                    ))}
                    {w.bars.map((b) => {
                      const it = items[b.index];
                      return (
                        <a
                          key={`${it.trip.slug}-${wi}`}
                          className={`vms-cal-bar is-${it.status}${b.continuesBefore ? " cont-before" : ""}${b.continuesAfter ? " cont-after" : ""}`}
                          style={{ gridColumn: `${b.col} / span ${b.span}` }}
                          href={it.href}
                          title={`${it.title} — ${statusText(it.status, t)}`}
                        >
                          {it.title}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {list}
    </div>
  );
}
