import { getFloatingWidgets } from "../lib/queries";
import { getContainerContent, type CellpyBlockContent } from "../lib/cellpy-block";
import { CellpyBlock } from "./CellpyBlock";
import { recaptchaScriptAttrs } from "./SitePage";

// Set on the Vercel project at provisioning time (US-VMAS-DEPLOY-04), same
// as SitePage.tsx/app/layout.tsx's own copy of this constant.
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;
const COOKIE_BANNER_CONTAINER_SLUG = "cookie-banner";

type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "mid-right" | "mid-left" | "bottom-center";
const POSITIONS: Position[] = ["bottom-right", "bottom-left", "top-right", "top-left", "mid-right", "mid-left", "bottom-center"];

interface FloatingWidgetRow {
  id: string;
  cellpyContainerSlug: string;
  position: string;
  deviceVisibility: string;
  mode: string;
  popupTargetContainerSlug: string | null;
  popupStyle: string | null;
  enabled: boolean;
  sortOrder: number;
}

// Site-wide floating buttons/popup-triggers, rendered once in app/layout.tsx
// (not per-page, same as the footer/cookie banner). Positioning is 100%
// trusted CSS (.fw-bucket* rules in app/globals.css) keyed off the
// `data-position`/`data-fw-*` attributes rendered here — never anything in
// a widget's own block CSS, which stays subject to Cellpy's normal
// LAYOUT_ESCAPE rule like any other block.
//
// The cookie-consent reopen control is folded into this same bottom-right
// bucket (as its first flex child) rather than kept as its own independent
// `position: fixed` element — see app/globals.css's .fw-bucket comment —
// so it can never pixel-collide with a floating widget anchored at the same
// corner. Its sibling, the actual consent banner bar
// ([data-cellpy-cookie-banner]), keeps its own full-width `position: fixed`
// rule regardless of where in the DOM it's nested (fixed positioning uses
// the viewport as its containing block, not the parent flex context), so
// nesting the whole cookie-banner block here doesn't change how the bar
// itself renders.
export async function FloatingWidgets({
  locale,
  cookieBannerContent,
}: {
  locale: string;
  cookieBannerContent: CellpyBlockContent | null;
}) {
  const rows = (await getFloatingWidgets()) as FloatingWidgetRow[];

  const triggerContents = await Promise.all(
    rows.map((w) => getContainerContent(ACCOUNT_SLUG, w.cellpyContainerSlug, locale))
  );
  const popupWidgets = rows.filter((w) => w.mode === "popup" && w.popupTargetContainerSlug);
  const popupContents = await Promise.all(
    popupWidgets.map((w) => getContainerContent(ACCOUNT_SLUG, w.popupTargetContainerSlug!, locale))
  );
  const popupContentBySlug = new Map(popupWidgets.map((w, i) => [w.id, popupContents[i]]));

  if (rows.length === 0 && !cookieBannerContent) return null;

  const hasForm = popupContents.some((c) => c?.formConfig);
  const hasLightbox = popupContents.some((c) => c?.html.includes("cellpy-lightbox"));
  const hasBooking = popupContents.some((c) => c?.html.includes("data-cellpy-booking-widget"));

  const byBucket = new Map<Position, Array<{ row: FloatingWidgetRow; content: CellpyBlockContent | null }>>();
  rows.forEach((row, i) => {
    if (!POSITIONS.includes(row.position as Position)) return; // defensive — unknown position, skip rather than render unpositioned
    const bucket = row.position as Position;
    const list = byBucket.get(bucket) ?? [];
    list.push({ row, content: triggerContents[i] });
    byBucket.set(bucket, list);
  });

  const buckets = POSITIONS.filter((p) => byBucket.has(p) || (p === "bottom-right" && cookieBannerContent));

  return (
    <>
      {buckets.map((bucket) => (
        <div key={bucket} className={`fw-bucket fw-bucket--${bucket}`}>
          {bucket === "bottom-right" && cookieBannerContent ? (
            <CellpyBlock containerSlug={COOKIE_BANNER_CONTAINER_SLUG} content={cookieBannerContent} />
          ) : null}
          {(byBucket.get(bucket) ?? []).map(({ row, content }) => (
            <div
              key={row.id}
              className={`fw-slot fw-device--${row.deviceVisibility}`}
              data-fw-mode={row.mode}
              data-fw-widget-id={row.id}
            >
              <CellpyBlock containerSlug={row.cellpyContainerSlug} content={content} />
            </div>
          ))}
        </div>
      ))}
      {popupWidgets.map((w) => (
        <div
          key={w.id}
          id={`fw-popup-${w.id}`}
          className={`fw-popup fw-popup--${w.popupStyle ?? "modal"}`}
          hidden
        >
          <div className="fw-popup-backdrop" data-fw-popup-close />
          <div className="fw-popup-panel" role="dialog" aria-modal="true">
            <button type="button" className="fw-popup-close" data-fw-popup-close aria-label="Close">
              &times;
            </button>
            <CellpyBlock containerSlug={w.popupTargetContainerSlug!} content={popupContentBySlug.get(w.id) ?? null} />
          </div>
        </div>
      ))}
      {hasForm && <script src="/forms.js" defer {...recaptchaScriptAttrs()} />}
      {hasLightbox && <script src="/lightbox.js" defer />}
      {hasBooking && <script src="/booking.js" defer />}
      {rows.length > 0 && <script src="/floating-widgets.js" defer />}
    </>
  );
}
