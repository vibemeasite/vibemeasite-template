import { notFound } from "next/navigation";
import { getPageBySlug } from "../lib/queries.js";
import { getContainerContent } from "../lib/cellpy-block.js";
import { CellpyBlock } from "./CellpyBlock.js";

// Set on the Vercel project at provisioning time (US-VMAS-DEPLOY-04) —
// each site's own Cellpy service-account slug, needed to build its
// container CDN URLs.
const ACCOUNT_SLUG = process.env.CELLPY_ACCOUNT_SLUG!;

export async function SitePage({ slug }: { slug: string }) {
  const result = await getPageBySlug(slug);
  if (!result) notFound();

  const { containers } = result;

  const blocks = await Promise.all(
    containers.map(async (c) => ({
      slug: c.cellpyContainerSlug,
      content: await getContainerContent(ACCOUNT_SLUG, c.cellpyContainerSlug),
    }))
  );

  // forms.js is only ~4KB, but there's no reason to ship it to pages with
  // no form block at all — matches wp-cellpy's conditional-enqueue pattern.
  const hasForm = blocks.some((b) => b.content?.formConfig);

  return (
    <>
      {blocks.map((b) => (
        <CellpyBlock key={b.slug} containerSlug={b.slug} content={b.content} />
      ))}
      {hasForm && <script src="/forms.js" defer />}
    </>
  );
}
