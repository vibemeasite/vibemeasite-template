import type { ReactNode } from "react";
import { getTripForPage } from "../lib/travel-query";
import { getSiteSettings } from "../lib/queries";
import {
  tripStatus, resolveText, travelTextToHtml, safeImageUrl, safeLinkUrl, formatTripDates, formatDayTime,
  formatDuration, googleMapsUrl, type TripStatus,
} from "../lib/travel-text";
import { travelStrings, type TravelStrings } from "../lib/travel-i18n";
import { getTripViewer, timeRevealedUpTo } from "../lib/trip-session";
import { TripRouteMap } from "./TripRouteMap";

// BSA Phase 27 — chrome for a "trips/{slug}" page (pages.seo_meta.trip, set by
// vibemeasite-mcp's create_trip), then the page's own Cellpy sections
// ({children}). Three versions (BSA Area 8):
//
//   preview      — the public, before/during the trip (and after it when the
//                  trip's post_trip_visibility is "participants"): header,
//                  illustrated map with plain pins + names, Start. No stop
//                  details in the HTML at all (P25).
//   participant  — a signed-in roster member (Phase 19 session, checked
//                  server-side against the control plane): every stop is in
//                  the HTML, revealed progressively by public/trip.js — by
//                  scheduled time, a later stop, test shortcuts (and GPS, slice
//                  4); everything after the trip. Locks are a surprise
//                  mechanic, not security (P25).
//   showcase     — anyone, after the trip, when post_trip_visibility is
//                  "public" (Q9): every stop, no locks.

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

const CLIENT_KEYS = [
  "start", "email", "sendCode", "codeSent", "code", "verify", "wrongCode", "expired", "tooMany", "genericError",
  "signOut", "nextStop", "testNext", "testAll", "testReset", "close", "changeEmail",
] as const;

export async function TripPage({ pageSlug, locale, defaultLocale, children }: Props) {
  const trip = await getTripForPage(pageSlug);
  if (!trip) return <>{children}</>;

  const settings = await getSiteSettings();
  const publicId = (settings as { visitorAuthPublicId?: string | null }).visitorAuthPublicId ?? null;
  const viewer = await getTripViewer(publicId, trip.slug);

  const t = travelStrings(locale);
  const now = Date.now();
  const status = tripStatus(trip, now);
  const ended = status === "past";
  const mode: "preview" | "participant" | "showcase" = viewer.participant
    ? "participant"
    : ended && trip.postTripVisibility === "public"
      ? "showcase"
      : "preview";

  const text = resolveText(trip.text, locale, defaultLocale);
  const cover = safeImageUrl(trip.coverImage);
  const book = status === "upcoming" ? safeLinkUrl(trip.bookUrl) : null; // no booking once a trip is under way
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
  const showStops = mode !== "preview";
  const revealedUpTo = mode === "participant" ? timeRevealedUpTo(stops, trip.endAt, now) : stops.length;
  const lockedFrom = mode === "participant" && revealedUpTo < stops.length ? revealedUpTo + 1 : undefined;
  const hasImages = showStops && stops.some((s) => s.images.length > 0);

  // Start (preview only): opens from access_from, closes after access_until.
  const accessOpen =
    !trip.cancelledAt &&
    (!trip.accessFrom || now >= Date.parse(trip.accessFrom)) &&
    (!trip.accessUntil || now <= Date.parse(trip.accessUntil));
  const startNotYet = !trip.cancelledAt && trip.accessFrom && now < Date.parse(trip.accessFrom);
  const showStart = mode === "preview" && !!publicId && (accessOpen || startNotYet) && stops.length > 0;
  const clientText = Object.fromEntries(CLIENT_KEYS.map((k) => [k, t[k]]));

  return (
    <>
      <div
        className={`vms-trip vms-trip--${status} vms-trip--${mode}`}
        data-trip={trip.slug}
        data-mode={mode}
        data-end-at={trip.endAt}
        data-i18n={JSON.stringify(clientText)}
      >
        <header className={`vms-trip__hero${cover ? " has-cover" : ""}`}>
          {cover && <img className="vms-trip__cover" src={cover} alt="" />}
          <div className="vms-trip__hero-inner">
            <span className={`vms-trip-badge vms-trip-badge--${status}`}>{statusLabel(status, t)}</span>
            <h1 className="vms-trip__title">{text?.title ?? trip.slug}</h1>
            <p className="vms-trip__dates">{formatTripDates(trip.startAt, trip.endAt, trip.timezone, locale)}</p>
            {status === "cancelled" && trip.cancelReason && <p className="vms-trip__cancel">{trip.cancelReason}</p>}
            {text?.summary && <div className="vms-trip__summary" dangerouslySetInnerHTML={{ __html: travelTextToHtml(text.summary) }} />}
            {book && mode !== "participant" && (
              <a className="vms-trip__book" href={localizeHref(book, locale, defaultLocale)}>{t.book}</a>
            )}
          </div>
        </header>

        {showStart && (
          <section className="vms-trip__start" data-pid={publicId!} data-trip={trip.slug}>
            <p className="vms-trip__start-hint">{t.startHint}</p>
            {accessOpen ? (
              <button type="button" className="vms-trip__start-btn">{t.start}</button>
            ) : (
              <p className="vms-trip__start-soon">
                {t.availableFrom} {new Intl.DateTimeFormat(locale, { timeZone: trip.timezone, day: "numeric", month: "long" }).format(new Date(trip.accessFrom!))}
              </p>
            )}
            <div className="vms-start" hidden />
          </section>
        )}

        {mode === "participant" && viewer.participant && (
          <section className="vms-trip__me">
            <p className="vms-trip__me-line">
              {t.signedInAs} <strong>{viewer.name || viewer.email}</strong>
              {" · "}
              <button type="button" className="vms-trip__signout">{t.signOut}</button>
            </p>
            {!ended && <p className="vms-trip__me-note">{t.unlockedNote}</p>}
          </section>
        )}

        <section className="vms-trip__route" aria-labelledby="vms-trip-route-h">
          <h2 id="vms-trip-route-h" className="vms-trip__h2">{t.route}</h2>
          {stops.length === 0 ? (
            <p className="vms-trip__soon">{t.routeSoon}</p>
          ) : (
            <>
              <TripRouteMap
                ariaLabel={`${t.route}: ${text?.title ?? trip.slug}`}
                stops={stops.map((s) => ({ position: s.position, lat: s.place.lat, lng: s.place.lng, mapX: s.mapX, mapY: s.mapY, title: s.title }))}
                interactive={showStops}
                lockedFrom={lockedFrom}
              />
              {mode === "preview" && ended && trip.postTripVisibility === "participants" && (
                <p className="vms-trip__soon">{t.participantsOnly}</p>
              )}
              {mode === "participant" && (
                <div className="vms-trip__next" hidden={lockedFrom === undefined}>
                  <span className="vms-trip__next-label">{t.nextStop}</span>
                  <span className="vms-trip__next-title">{lockedFrom !== undefined ? stops[lockedFrom - 1]?.title : ""}</span>
                  <span className="vms-trip__next-lock" aria-hidden="true">🔒</span>
                </div>
              )}
              {showStops && (
                <ol className="vms-trip__stops" aria-label={t.stops}>
                  {stops.map((s) => {
                    const locked = lockedFrom !== undefined && s.position >= lockedFrom;
                    return (
                      <li key={s.position} className={`vms-trip__stop-item${locked ? " is-locked" : ""}`} data-stop-item={s.position}>
                        <article
                          id={`stop-${s.position}`}
                          className={`vms-stop${locked ? " is-locked" : ""}`}
                          data-stop={s.position}
                          data-title={s.title}
                          data-reveal-at={s.arriveAt ?? ""}
                          data-lat={s.place.lat}
                          data-lng={s.place.lng}
                          data-radius={s.revealRadiusM}
                        >
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
                    );
                  })}
                </ol>
              )}
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
