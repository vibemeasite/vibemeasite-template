import { NextRequest, NextResponse } from "next/server";
import { getEntity, getEntriesPage, getEntryLangs, resolveEntryLang, getSiteSettings } from "../../../../lib/queries";
import { clampPage, readQ, readFacets, LOCALE_RE, type SearchParamsRecord } from "../../../../lib/entries-query";
import { renderEntryList } from "../../../../lib/entry-render";

// BSA Phase 16 — the infinite-scroll pager behind public/directory.js.
// Returns an HTML fragment: the same `<article class="entry">` markup
// <EntityList> renders, plus a fresh sentinel div when more pages remain.
// Public, read-only, published rows only. Shares its query construction
// (lib/entries-query.ts) and rendering (lib/entry-render.ts) with
// <EntityList>, so the injection rules can't diverge.
//
// Multi-language entries (v22): directory.js forwards the directory's
// resolved language as `?lang=` (from the wrap's data-lang). It's
// re-resolved here through the same resolveEntryLang path so a stale
// value can't blank the list.

export const dynamic = "force-dynamic";

function toRecord(sp: URLSearchParams): SearchParamsRecord {
  const out: SearchParamsRecord = {};
  for (const [k, v] of sp.entries()) {
    if (!(k in out)) out[k] = v;
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entity = await getEntity(slug);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp = toRecord(req.nextUrl.searchParams);
  const page = clampPage(sp.page);
  const q = readQ(sp);
  const facets = readFacets(entity, sp);
  const rawSort = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort =
    rawSort === "newest" || rawSort === "oldest"
      ? rawSort
      : rawSort && entity.fields.some((f) => f.key === rawSort)
        ? rawSort
        : entity.defaultSort || "newest";
  const pageSize = Math.min(Math.max(entity.pageSize ?? 24, 1), 100);

  const rawLang = typeof sp.lang === "string" && LOCALE_RE.test(sp.lang) ? sp.lang : undefined;
  const [availableLangs, settings] = await Promise.all([getEntryLangs(slug), getSiteSettings()]);
  const lang = resolveEntryLang(availableLangs, rawLang ?? settings.defaultLocale, settings.defaultLocale);

  const { rows, hasMore } = await getEntriesPage({ entity, q, facets, sort, page, pageSize, lang });

  const html =
    renderEntryList(entity, rows) +
    (hasMore
      ? `<div data-entry-sentinel data-slug="${slug}" data-next="${page + 1}"${lang ? ` data-lang="${lang}"` : ""} hidden></div>`
      : "");

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
