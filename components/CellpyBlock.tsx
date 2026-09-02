import { scopeCss } from "../lib/css-scope";
import type { CellpyBlockContent } from "../lib/cellpy-block";
import type { SearchParamsRecord } from "../lib/entries-query";
import { EntityList } from "./EntityList";

interface CellpyBlockProps {
  containerSlug: string;
  content: CellpyBlockContent | null;
  // BSA Phase 16 — passed down from SitePage/ScrollPage (which get it from
  // the route). Only used when this block's HTML carries a
  // `<div data-entity="…">` mount marker.
  searchParams?: SearchParamsRecord;
}

// Matches an empty <div data-entity="slug" [data-page-size="N"]
// [data-sort="key"]></div> placeholder in any attribute order. The div is
// authored empty (a mount point), so `>\s*</div>` / a self-closed `/>` both
// count.
const ENTITY_MARKER_RE =
  /<div\b(?=[^>]*\bdata-entity=)[^>]*>\s*<\/div>|<div\b(?=[^>]*\bdata-entity=)[^>]*\/>/gi;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1] : undefined;
}

// Server-rendered equivalent of wp-cellpy's Cellpy_Css_Scope::wrap() — a
// plain wrapper div with regex-scoped CSS, not the client-side
// <cellpy-block> custom element (which always creates its own Shadow DOM
// and can only render content it fetched itself — it cannot attach
// behavior to already-rendered markup, so it has no role in this template).
export async function CellpyBlock({ containerSlug, content, searchParams }: CellpyBlockProps) {
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

  ENTITY_MARKER_RE.lastIndex = 0;
  const hasMarker = ENTITY_MARKER_RE.test(content.html);

  if (!hasMarker) {
    return (
      <>
        <style>{scopedCss}</style>
        <div className={wrapper} {...formAttrs} dangerouslySetInnerHTML={{ __html: content.html }} />
      </>
    );
  }

  // Split the block HTML around each marker and interleave <EntityList>.
  // The raw HTML chunks go into `display: contents` wrappers so the block's
  // own scoped CSS still targets its real elements as direct descendants of
  // `.cellpy-block-{slug}`.
  ENTITY_MARKER_RE.lastIndex = 0;
  type Part = { kind: "html"; html: string } | { kind: "entity"; slug: string; pageSize?: number; sort?: string } | { kind: "dup"; slug: string };
  const parts: Part[] = [];
  const seen = new Set<string>();
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = ENTITY_MARKER_RE.exec(content.html)) !== null) {
    parts.push({ kind: "html", html: content.html.slice(last, m.index) });
    const tag = m[0];
    const slug = (attr(tag, "data-entity") ?? "").toLowerCase();
    if (!slug || !/^[a-z0-9-]{1,64}$/.test(slug)) {
      parts.push({ kind: "html", html: tag }); // leave an unparseable marker as-is
    } else if (seen.has(slug)) {
      parts.push({ kind: "dup", slug });
    } else {
      seen.add(slug);
      const ps = Number(attr(tag, "data-page-size"));
      const so = attr(tag, "data-sort");
      parts.push({
        kind: "entity",
        slug,
        pageSize: Number.isInteger(ps) && ps > 0 ? ps : undefined,
        sort: so && /^[a-z0-9_]{1,64}$/.test(so) ? so : undefined,
      });
    }
    last = m.index + tag.length;
  }
  parts.push({ kind: "html", html: content.html.slice(last) });

  return (
    <>
      <style>{scopedCss}</style>
      <div className={wrapper} {...formAttrs}>
        {parts.map((p, i) => {
          if (p.kind === "html") {
            return p.html
              ? <div key={i} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: p.html }} />
              : null;
          }
          if (p.kind === "dup") {
            return (
              <p key={i} className="entry-error">
                This directory is already shown above.
              </p>
            );
          }
          return (
            <EntityList
              key={i}
              slug={p.slug}
              pageSize={p.pageSize}
              sort={p.sort}
              searchParams={searchParams ?? {}}
            />
          );
        })}
      </div>
    </>
  );
}
