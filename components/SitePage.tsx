import { notFound } from "next/navigation";
import { getPageBySlug } from "../lib/queries";
import { getContainerContent, type CellpyBlockContent } from "../lib/cellpy-block";
import { CellpyBlock } from "./CellpyBlock";

// Set on the Vercel project at provisioning time (US-VMAS-DEPLOY-04) —
// each site's own Cellpy service-account slug, needed to build its
// container CDN URLs.
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;

interface LoadedBlock {
  slug: string;
  content: CellpyBlockContent | null;
}

async function loadBlocks(containers: Array<{ cellpyContainerSlug: string }>): Promise<LoadedBlock[]> {
  return Promise.all(
    containers.map(async (c) => ({
      slug: c.cellpyContainerSlug,
      content: await getContainerContent(ACCOUNT_SLUG, c.cellpyContainerSlug),
    }))
  );
}

export async function SitePage({ slug }: { slug: string }) {
  const result = await getPageBySlug(slug);
  if (!result) notFound();

  const blocks = await loadBlocks(result.containers);

  // forms.js and lightbox.js are each only a few KB, but there's no reason
  // to ship either to pages that don't need it — matches wp-cellpy's
  // conditional-enqueue pattern. lightbox.js activates on any block whose
  // authored HTML marks an <img> with class="cellpy-lightbox" (see
  // vibemeasite/docs/bsa-documentation-vibemeasite-service.md, US-VMAS-CHAT-05).
  const hasForm = blocks.some((b) => b.content?.formConfig);
  const hasLightbox = blocks.some((b) => b.content?.html.includes("cellpy-lightbox"));

  return (
    <>
      {blocks.map((b) => (
        <CellpyBlock key={b.slug} containerSlug={b.slug} content={b.content} />
      ))}
      {hasForm && <script src="/forms.js" defer />}
      {hasLightbox && <script src="/lightbox.js" defer />}
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
  const rendered = await Promise.all(
    sections.map(async (s) => ({ slug: s.slug, blocks: await loadBlocks(s.containers) }))
  );
  const hasForm = rendered.some((s) => s.blocks.some((b) => b.content?.formConfig));
  const hasLightbox = rendered.some((s) =>
    s.blocks.some((b) => b.content?.html.includes("cellpy-lightbox"))
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
      {hasForm && <script src="/forms.js" defer />}
      {hasLightbox && <script src="/lightbox.js" defer />}
    </>
  );
}
