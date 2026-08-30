import { notFound } from "next/navigation";
import { getPageBySlug, getSiteSettings } from "../lib/queries";
import { getContainerContent, type CellpyBlockContent } from "../lib/cellpy-block";
import { getCurrentLocale } from "../lib/locale";
import { CellpyBlock } from "./CellpyBlock";

// Set on the Vercel project at provisioning time (US-VMAS-DEPLOY-04) —
// each site's own Cellpy service-account slug, needed to build its
// container CDN URLs.
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;

// Set by connect_recaptcha (vibemeasite-mcp) for sites that opt in — both
// unset (the default) means no reCAPTCHA, forms.js behaves exactly as
// before. Stamped onto the forms.js <script> tag as data-* attributes
// rather than NEXT_PUBLIC_* env vars: this is a Server Component, so the
// value only needs to reach the rendered HTML, not the client bundle — see
// forms.js's own document.currentScript read of these same attributes.
export function recaptchaScriptAttrs(): Record<string, string> {
  const type = process.env.RECAPTCHA_TYPE;
  const siteKey = process.env.RECAPTCHA_SITE_KEY;
  return type && siteKey ? { "data-recaptcha-type": type, "data-recaptcha-site-key": siteKey } : {};
}

interface LoadedBlock {
  slug: string;
  content: CellpyBlockContent | null;
}

async function loadBlocks(
  containers: Array<{ cellpyContainerSlug: string }>,
  locale: string
): Promise<LoadedBlock[]> {
  return Promise.all(
    containers.map(async (c) => ({
      slug: c.cellpyContainerSlug,
      content: await getContainerContent(ACCOUNT_SLUG, c.cellpyContainerSlug, locale),
    }))
  );
}

export async function SitePage({ slug }: { slug: string }) {
  const [result, settings] = await Promise.all([getPageBySlug(slug), getSiteSettings()]);
  if (!result) notFound();

  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  const blocks = await loadBlocks(result.containers, locale);

  // forms.js and lightbox.js are each only a few KB, but there's no reason
  // to ship either to pages that don't need it — matches wp-cellpy's
  // conditional-enqueue pattern. lightbox.js activates on any block whose
  // authored HTML marks an <img> with class="cellpy-lightbox" (see
  // vibemeasite/docs/bsa-documentation-vibemeasite-service.md, US-VMAS-CHAT-05).
  const hasForm = blocks.some((b) => b.content?.formConfig);
  const hasLightbox = blocks.some((b) => b.content?.html.includes("cellpy-lightbox"));
  // BSA Phase 10 (US-VMAS-SCHED-04) — the booking widget block's fixed
  // skeleton always carries this data attribute (lib/booking-widget-template.ts
  // on the vibemeasite-mcp side), same conditional-enqueue pattern as forms/lightbox.
  const hasBooking = blocks.some((b) => b.content?.html.includes("data-cellpy-booking-widget"));
  // Host scripts that hydrate static block markup the block-validator won't
  // let a block script itself — a <span data-countdown> live timer and a
  // <div class="video-embed" data-youtube/data-vimeo> click-to-load player.
  // Same conditional-enqueue reasoning as forms/lightbox above.
  const hasCountdown = blocks.some((b) => b.content?.html.includes("data-countdown"));
  const hasVideoEmbed = blocks.some((b) => b.content?.html.includes("video-embed"));

  return (
    <>
      {blocks.map((b) => (
        <CellpyBlock key={b.slug} containerSlug={b.slug} content={b.content} />
      ))}
      {hasForm && <script src="/forms.js" defer {...recaptchaScriptAttrs()} />}
      {hasLightbox && <script src="/lightbox.js" defer />}
      {hasBooking && <script src="/booking.js" defer />}
      {hasCountdown && <script src="/countdown.js" defer />}
      {hasVideoEmbed && <script src="/video-embed.js" defer />}
    </>
  );
}

export interface ScrollSection {
  slug: string;
  containers: Array<{ cellpyContainerSlug: string }>;
}

// One-page layout mode's root route ("/") renders every in-scroll page's
// containers concatenated, each wrapped in its own <section id="{slug}">
// anchor target, instead of SitePage's single-page rendering. forms.js is
// included at most once for the whole concatenated page — including it per
// section would re-run its form-binding init code once per <script> tag.
export async function ScrollPage({ sections }: { sections: ScrollSection[] }) {
  const settings = await getSiteSettings();
  const locale = await getCurrentLocale(settings.defaultLocale, (settings.availableLocales as string[] | null) ?? []);
  const rendered = await Promise.all(
    sections.map(async (s) => ({ slug: s.slug, blocks: await loadBlocks(s.containers, locale) }))
  );
  const hasForm = rendered.some((s) => s.blocks.some((b) => b.content?.formConfig));
  const hasLightbox = rendered.some((s) =>
    s.blocks.some((b) => b.content?.html.includes("cellpy-lightbox"))
  );
  const hasBooking = rendered.some((s) =>
    s.blocks.some((b) => b.content?.html.includes("data-cellpy-booking-widget"))
  );
  const hasCountdown = rendered.some((s) =>
    s.blocks.some((b) => b.content?.html.includes("data-countdown"))
  );
  const hasVideoEmbed = rendered.some((s) =>
    s.blocks.some((b) => b.content?.html.includes("video-embed"))
  );

  return (
    <>
      {rendered.map((s) => (
        <section key={s.slug} id={s.slug}>
          {s.blocks.map((b) => (
            <CellpyBlock key={b.slug} containerSlug={b.slug} content={b.content} />
          ))}
        </section>
      ))}
      {hasForm && <script src="/forms.js" defer {...recaptchaScriptAttrs()} />}
      {hasLightbox && <script src="/lightbox.js" defer />}
      {hasBooking && <script src="/booking.js" defer />}
      {hasCountdown && <script src="/countdown.js" defer />}
      {hasVideoEmbed && <script src="/video-embed.js" defer />}
    </>
  );
}
