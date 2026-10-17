import type { ReactNode } from "react";
import { getTripForPage, getTripPosts, type TripPostView } from "../lib/travel-query";
import { getSiteSettings } from "../lib/queries";
import {
  tripStatus, resolveText, travelTextToHtml, safeImageUrl, safeLinkUrl, formatTripDates, formatDayTime,
  formatDuration, googleMapsUrl, escapeHtml, type TripStatus,
} from "../lib/travel-text";
import { travelStrings, type TravelStrings } from "../lib/travel-i18n";
import { getTripViewer, timeRevealedUpTo } from "../lib/trip-session";
import { TripRouteMap } from "./TripRouteMap";
import { langLabel } from "../lib/lang-names";
import { tripAudioSrc } from "../lib/trip-offline";

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
//
// Below the route: the trip wall (slice 5, US-VMAS-TRAVEL-16) — participants'
// photos and notes, newest first by day. Every visitor sees it when the
// trip's wall_visibility is "public", participants only otherwise. A pending
// post (posts_premoderated) is shown only to its author. public/trip-wall.js
// adds the composer and the offline outbox (participant version only).

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
  "offlineTitle", "offlineIntro", "offlineDownload", "offlineSaving", "offlineKeepOpen", "offlinePaused",
  "offlinePausedHint", "offlineResume", "offlineReady", "offlineUntil", "offlineNow", "offlineNeedNet",
  "offlineUpdate", "offlineIosHint", "offlineInstall", "offlineRemove", "offlineRemoveConfirm",
  "offlineLowSpace", "offlineUnsupported",
  "geoOn", "geoHint", "geoFinding", "geoDenied", "geoUnavailable", "geoNearest", "geoArrived", "testGps",
  "wallTitle", "wallAdd", "wallTextPh", "wallPhotos", "wallCaptionPh", "wallStop", "wallNoStop", "wallPost", "wallCancel",
  "wallWaiting", "wallSending", "wallPending", "wallFailed", "wallDelete", "wallDeleteConfirm", "wallEdit", "wallSave",
  "wallNeedDownload", "wallClosed", "wallAll", "wallEmpty", "wallParticipant", "wallTooMany", "wallTooLong", "wallEmptyPost",
  "wallSignedOut", "wallOffline",
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

  // Trip wall.
  const wallVisible = mode === "participant" || trip.wallVisibility === "public";
  const viewerEmail = viewer.participant ? viewer.email : null;
  const posts = wallVisible
    ? (await getTripPosts(trip.slug)).filter((p) => p.status === "published" || (viewerEmail !== null && p.authorEmail === viewerEmail))
    : [];
  const showWall = wallVisible && (mode === "participant" || posts.length > 0);
  const wallDays = groupPostsByDay(posts, trip.timezone, locale);
  const stopTitle = new Map(stops.map((s) => [s.position, s.title]));
  const taggedStops = [...new Set(posts.map((p) => p.stopPosition).filter((n): n is number => n !== null && stopTitle.has(n)))].sort((a, b) => a - b);
  const wallHasImages = posts.some((p) => p.images.length > 0);
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone: trip.timezone, hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div
        className={`vms-trip vms-trip--${status} vms-trip--${mode}`}
        data-trip={trip.slug}
        data-mode={mode}
        data-start-at={trip.startAt}
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
            {/* Filled by trip.js — dangerouslySetInnerHTML makes React treat the contents as opaque, so script-written markup never trips hydration. */}
            <div className="vms-start" hidden dangerouslySetInnerHTML={{ __html: "" }} />
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
            {/* Live location (slice 4) — filled by public/trip-geo.js during the trip. */}
            <div className="vms-geo" hidden dangerouslySetInnerHTML={{ __html: "" }} />
            {/* Offline trip mode (slice 3) — filled by public/trip-offline.js. */}
            <div className="vms-offline" hidden dangerouslySetInnerHTML={{ __html: "" }} />
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
                  {/* Text rewritten by trip.js as stops unlock — opaque to React hydration. */}
                  <span
                    className="vms-trip__next-title"
                    dangerouslySetInnerHTML={{ __html: escapeHtml(lockedFrom !== undefined ? stops[lockedFrom - 1]?.title ?? "" : "") }}
                  />
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
                          {mode === "participant" && s.place.audio.length > 0 && (() => {
                            // Page language → site default → first available (BSA P17).
                            const pick = s.place.audio.find((a) => a.lang === locale) ?? s.place.audio.find((a) => a.lang === defaultLocale) ?? s.place.audio[0];
                            const src = (lang: string, version: string) => tripAudioSrc(trip.slug, s.place.slug, lang, version);
                            return (
                              <div className="vms-audio" data-audio-for={s.position}>
                                <p className="vms-audio__label">
                                  <span aria-hidden="true">🎧</span> {t.audioGuide}
                                  {pick.durationSec ? <span className="vms-audio__dur"> · {formatDuration(Math.round(pick.durationSec / 60), locale)}</span> : null}
                                </p>
                                <audio className="vms-audio__player" controls preload="none" src={src(pick.lang, pick.version)} data-lang={pick.lang} />
                                {s.place.audio.length > 1 && (
                                  <p className="vms-audio__langs">
                                    {t.audioAlso}:{" "}
                                    {s.place.audio.map((a) => (
                                      <button
                                        key={a.lang}
                                        type="button"
                                        className={`vms-audio__lang${a.lang === pick.lang ? " is-current" : ""}`}
                                        data-src={src(a.lang, a.version)}
                                        data-lang={a.lang}
                                      >
                                        {langLabel(a.lang, "native")}
                                      </button>
                                    ))}
                                  </p>
                                )}
                                {pick.transcript && (
                                  <details className="vms-audio__transcript">
                                    <summary>{t.transcript}</summary>
                                    <div dangerouslySetInnerHTML={{ __html: travelTextToHtml(pick.transcript) }} />
                                  </details>
                                )}
                              </div>
                            );
                          })()}
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

        {showWall && (
          <section
            className="vms-wall"
            aria-labelledby="vms-wall-h"
            data-open={accessOpen ? "1" : "0"}
            data-stops={JSON.stringify(stops.map((s) => ({ p: s.position, t: s.title })))}
          >
            <h2 id="vms-wall-h" className="vms-trip__h2">{t.wallTitle}</h2>
            {mode === "participant" && (
              // Filled by trip-wall.js (composer + offline outbox) — opaque to hydration.
              <div className="vms-wall__compose" hidden dangerouslySetInnerHTML={{ __html: "" }} />
            )}
            {taggedStops.length > 0 && (
              <div className="vms-wall__filter" role="group" aria-label={t.wallStop}>
                <button type="button" className="vms-wall__chip is-current" data-filter="">{t.wallAll}</button>
                {taggedStops.map((n) => (
                  <button key={n} type="button" className="vms-wall__chip" data-filter={n}>
                    {n}. {stopTitle.get(n)}
                  </button>
                ))}
              </div>
            )}
            {posts.length === 0 && <p className="vms-wall__empty">{t.wallEmpty}</p>}
            {wallDays.map((day) => (
              <div key={day.key} className="vms-wall__day" data-day={day.key}>
                <h3 className="vms-wall__day-h">{day.label}</h3>
                {day.posts.map((p) => {
                  const mine = viewerEmail !== null && p.authorEmail === viewerEmail;
                  const tag = p.stopPosition !== null ? stopTitle.get(p.stopPosition) : undefined;
                  const photos = p.images.flatMap((i) => {
                    const url = safeImageUrl(i.url);
                    return url ? [{ url, caption: i.caption }] : [];
                  });
                  return (
                    <article
                      key={p.id}
                      id={`post-${p.id}`}
                      className={`vms-post cellpy-block-post${p.status === "pending" ? " is-pending" : ""}`}
                      data-post={p.id}
                      data-stop={p.stopPosition ?? ""}
                      data-mine={mine ? "1" : undefined}
                    >
                      <header className="vms-post__head">
                        <strong className="vms-post__author">{p.authorName || t.wallParticipant}</strong>
                        <time className="vms-post__time" dateTime={p.createdAt}>{timeFmt.format(new Date(p.createdAt))}</time>
                        {tag && (showStops
                          ? <a className="vms-post__stop" href={`#stop-${p.stopPosition}`}>📍 {tag}</a>
                          : <span className="vms-post__stop">📍 {tag}</span>)}
                        {p.status === "pending" && <span className="vms-post__badge">{t.wallPending}</span>}
                      </header>
                      {p.body && <div className="vms-post__body" dangerouslySetInnerHTML={{ __html: escapeHtml(p.body).replace(/\n/g, "<br>") }} />}
                      {photos.length > 0 && (
                        <div className={`vms-post__photos vms-post__photos--${Math.min(photos.length, 4)}`}>
                          {photos.map((ph, i) => (
                            <figure key={i} className="vms-post__photo">
                              <img className="cellpy-lightbox" src={ph.url} alt={ph.caption ?? ""} loading="lazy" />
                              {ph.caption && <figcaption>{ph.caption}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      )}
                      {mine && (
                        <p className="vms-post__own">
                          <button type="button" className="vms-post__act" data-act="edit">{t.wallEdit}</button>
                          <button type="button" className="vms-post__act" data-act="delete">{t.wallDelete}</button>
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        <div className="vms-trip__sections">{children}</div>
      </div>
      <script src="/trip.js" defer data-close-label={t.close} />
      {mode === "participant" && <script src="/trip-offline.js" defer />}
      {mode === "participant" && <script src="/trip-geo.js" defer />}
      {showWall && <script src="/trip-wall.js" defer />}
      {(hasImages || wallHasImages || mode === "participant") && <script src="/lightbox.js" defer />}
    </>
  );
}

// Days in the trip's own timezone, newest first (posts arrive newest first).
function groupPostsByDay(posts: TripPostView[], timeZone: string, locale: string): Array<{ key: string; label: string; posts: TripPostView[] }> {
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const labelFmt = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
  const days: Array<{ key: string; label: string; posts: TripPostView[] }> = [];
  for (const p of posts) {
    const d = new Date(p.createdAt);
    const key = keyFmt.format(d);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: labelFmt.format(d), posts: [] };
      days.push(day);
    }
    day.posts.push(p);
  }
  return days;
}
