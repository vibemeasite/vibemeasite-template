import { scopeCss } from "../lib/css-scope";
import type { CellpyBlockContent } from "../lib/cellpy-block";

interface CellpyBlockProps {
  containerSlug: string;
  content: CellpyBlockContent | null;
}

// Server-rendered equivalent of wp-cellpy's Cellpy_Css_Scope::wrap() — a
// plain wrapper div with regex-scoped CSS, not the client-side
// <cellpy-block> custom element (which always creates its own Shadow DOM
// and can only render content it fetched itself — it cannot attach
// behavior to already-rendered markup, so it has no role in this template).
export function CellpyBlock({ containerSlug, content }: CellpyBlockProps) {
  if (!content) return null;

  // Slugs are already constrained to /^[a-z0-9-]{1,64}$/ (US-VMAS-CHAT-03 /
  // generate_block validation) — safe to use directly as a class name,
  // unlike wp-cellpy's opaque hash (not needed here since we control slug
  // generation end-to-end, wp-cellpy accepts arbitrary user-typed slugs).
  const wrapper = `cellpy-block-${containerSlug}`;
  const scopedCss = scopeCss(content.css, wrapper);

  const formAttrs = content.formConfig
    ? {
        "data-cellpy-form-slug": containerSlug,
        "data-cellpy-form-config": JSON.stringify(content.formConfig),
      }
    : {};

  return (
    <>
      <style>{scopedCss}</style>
      <div className={wrapper} {...formAttrs} dangerouslySetInnerHTML={{ __html: content.html }} />
    </>
  );
}
