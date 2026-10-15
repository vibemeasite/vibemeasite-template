import type { ReactNode } from "react";
import { getTripForPage } from "../lib/travel-query";
import {
  tripStatus, resolveText, travelTextToHtml, safeImageUrl, safeLinkUrl, formatTripDates, formatDayTime,
  formatDuration, googleMapsUrl, type TripStatus,
} from "../lib/travel-text";
import { travelStrings, type TravelStrings } from "../lib/travel-i18n";
import { TripRouteMap } from "./TripRouteMap";

// BSA Phase 27 (US-VMAS-TRAVEL-04/06) — chrome for a "trips/{slug}" page
// (pages.seo_meta.trip, set by vibemeasite-mcp's create_trip): trip header,
// schematic route map, stop list — then the page's own Cellpy sections
// ({children}, added with generate_block), same wrapping idea as
// BlogPostChrome. public/trip.js adds the stop panel (works without JS too).

interface Props {
  pageSlug: string;
  locale: string;
  defaultLocale: string;
  children: ReactNode;
}

export function statusLabel(status: TripStatus, t: TravelStrings): string {
  return status === "upcoming" ? t.upcoming : status === "in_progress" ? t.now : status === "past" ? t.past : t.cancelled;
}

function localizeHref(href: string, locale: string, defaultLocale: string): string {
  if (locale === defaultLocale || !href.startsWith("/") || href.startsWith("//")) return href;
  return `/${locale}${href === "/" ? "" : href}`;
}

export async function TripPage({ pageSlug, locale, defaultLocale, children }: Props) {
  const trip = await getTripForPage(pageSlug);
  if (!trip) return <>{children}</>;

  const t = travelStrings(locale);
  const status = tripStatus(trip);
  const text = resolveText(trip.text, locale, defaultLocale);
  const cover = safeImageUrl(trip.coverImage);
  const book = status === "upcoming" || status === "in_progress" ? safeLinkUrl(trip.bookUrl) : null;
  const stops = trip.stops.map((s) => {
    const pt = resolveText(s.place.text, locale, defaultLocale);
    return {
      ...s,
      title: pt?.title ?? s.place.slug,
      summaryHtml: travelTextToHtml(pt?.summary),
      historyHtml: travelTextToHtml(pt?.history),
      noteHtml: travelTextToHtml(resolveText(s.note, locale, defaultLocale)),
      images: s.place.images.flatMap((i) => {
        const url = safeImageUrl(i.url);
        return url ? [{ url, alt: i.alt }] : [];
      }),
    };
  });
  const hasImages = stops.some((s) => s.images.length > 0);

  return (
    <>
      <div className={`vms-trip vms-trip--${status}`} data-trip={trip.slug}>
        <header className={`vms-trip__hero${cover ? " has-cover" : ""}`}>
          {cover && <img className="vms-trip__cover" src={cover} alt="" />}
          <div className="vms-trip__hero-inner">
            <span className={`vms-trip-badge vms-trip-badge--${status}`}>{statusLabel(status, t)}</span>
            <h1 className="vms-trip__title">{text?.title ?? trip.slug}</h1>
            <p className="vms-trip__dates">{formatTripDates(trip.startAt, trip.endAt, trip.timezone, locale)}</p>
            {status === "cancelled" && trip.cancelReason && <p className="vms-trip__cancel">{trip.cancelReason}</p>}
            {text?.summary && <div className="vms-trip__summary" dangerouslySetInnerHTML={{ __html: travelTextToHtml(text.summary) }} />}
            {book && (
              <a className="vms-trip__book" href={localizeHref(book, locale, defaultLocale)}>{t.book}</a>
            )}
          </div>
        </header>

        <section className="vms-trip__route" aria-labelledby="vms-trip-route-h">
          <h2 id="vms-trip-route-h" className="vms-trip__h2">{t.route}</h2>
          {stops.length === 0 ? (
            <p className="vms-trip__soon">{t.routeSoon}</p>
          ) : (
            <>
              <TripRouteMap
                ariaLabel={`${t.route}: ${text?.title ?? trip.slug}`}
                stops={stops.map((s) => ({ position: s.position, lat: s.place.lat, lng: s.place.lng, mapX: s.mapX, mapY: s.mapY, title: s.title }))}
              />
              <ol className="vms-trip__stops" aria-label={t.stops}>
                {stops.map((s) => (
                  <li key={s.position} className="vms-trip__stop-item">
                    <article id={`stop-${s.position}`} className="vms-stop" data-stop={s.position}>
                      <header className="vms-stop__head">
                        <span className="vms-stop__num" aria-hidden="true">{s.position}</span>
                        <div>
                          <h3 className="vms-stop__title">{s.title}</h3>
                          {(s.arriveAt || s.durationMin) && (
                            <p className="vms-stop__meta">
                              {s.arriveAt && <span>{t.arrival}: {formatDayTime(s.arriveAt, trip.timezone, locale)}</span>}
                              {s.durationMin ? <span>{t.duration}: {formatDuration(s.durationMin, locale)}</span> : null}
                            </p>
                          )}
                        </div>
                      </header>
                      {s.noteHtml && <div className="vms-stop__note" dangerouslySetInnerHTML={{ __html: s.noteHtml }} />}
                      {s.images.length > 0 && (
                        <div className="vms-stop__photos" aria-label={t.photos}>
                          {s.images.map((img, i) => (
                            <img key={i} className="cellpy-lightbox vms-stop__photo" src={img.url} alt={img.alt ?? s.title} loading="lazy" />
                          ))}
                        </div>
                      )}
                      {s.summaryHtml && <div className="vms-stop__summary" dangerouslySetInnerHTML={{ __html: s.summaryHtml }} />}
                      {s.historyHtml && (
                        <details className="vms-stop__history">
                          <summary>{t.more}</summary>
                          <div dangerouslySetInnerHTML={{ __html: s.historyHtml }} />
                        </details>
                      )}
                      <p className="vms-stop__links">
                        <a href={googleMapsUrl(s.place.lat, s.place.lng)} target="_blank" rel="noopener" data-online-only="1">
                          {t.openInMaps}
                        </a>
                      </p>
                    </article>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <div className="vms-trip__sections">{children}</div>
      </div>
      <script src="/trip.js" defer data-close-label={t.close} />
      {hasImages && <script src="/lightbox.js" defer />}
    </>
  );
}
