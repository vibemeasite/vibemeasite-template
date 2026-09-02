import { getEntity, getEntriesPage, getFacetValues } from "../lib/queries";
import {
  clampPage, readQ, readFacets, facetParamName, withParams,
  type SearchParamsRecord, type EntityLite,
} from "../lib/entries-query";
import { renderEntryList } from "../lib/entry-render";

// BSA Phase 16 — renders one entity's directory where a
// `<div data-entity="{slug}">` marker appears in a section (see
// components/CellpyBlock.tsx). Server component: the first page, the search
// form, and the facet <select>s are all server-rendered so the directory
// works with JS disabled and is crawlable; public/directory.js then
// progressively enhances it (instant client filter + infinite scroll
// against /api/entries/[slug]).

interface Props {
  slug: string;
  pageSize?: number;
  sort?: string;
  searchParams: SearchParamsRecord;
}

function resolveSort(entity: EntityLite, sp: SearchParamsRecord, markerDefault?: string): string {
  const raw = sp.sort;
  const candidate = (typeof raw === "string" && raw) || markerDefault || entity.defaultSort || "newest";
  if (candidate === "newest" || candidate === "oldest") return candidate;
  return entity.fields.some((f) => f.key === candidate) ? candidate : "newest";
}

export async function EntityList({ slug, pageSize: markerPageSize, sort: markerSort, searchParams }: Props) {
  const entity = await getEntity(slug);
  if (!entity) return null;

  const page = clampPage(searchParams.page);
  const q = readQ(searchParams);
  const sort = resolveSort(entity, searchParams, markerSort);
  const facets = readFacets(entity, searchParams);
  const pageSize = Math.min(Math.max(markerPageSize ?? entity.pageSize ?? 24, 1), 100);

  const { rows, hasMore } = await getEntriesPage({ entity, q, facets, sort, page, pageSize });

  const facetFields = entity.fields.filter(
    (f) => f.filterable && (f.type === "select" || f.type === "text" || f.type === "tags"),
  );
  const facetControls = await Promise.all(
    facetFields.map(async (f) => {
      const values =
        f.type === "select" && Array.isArray(f.options) && f.options.length
          ? f.options
          : await getFacetValues(slug, f.key, f.type === "tags");
      return { field: f, values };
    }),
  );

  const heading = entity.pluralLabel ?? entity.name;
  const moreHref = withParams(searchParams, { page: page + 1 });

  return (
    <div className={`entry-list-wrap entry-list-wrap--${entity.layout}`} data-entry-list={slug}>
      <form className="entry-search" method="get" role="search" aria-label={`Search ${heading}`}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          className="entry-search__q"
          placeholder={`Search ${heading.toLowerCase()}…`}
          aria-label={`Search ${heading}`}
        />
        {facetControls.map(({ field, values }) => (
          <select
            key={field.key}
            name={facetParamName(field.key)}
            className="entry-search__facet"
            defaultValue={facets[field.key] ?? ""}
            aria-label={field.label}
          >
            <option value="">{field.label}: all</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        <button type="submit" className="entry-search__go">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="entry-empty">
          {q || Object.keys(facets).length ? "No matches." : "Nothing here yet."}
        </p>
      ) : (
        <div
          className={`entry-list entry-list--${entity.layout}`}
          dangerouslySetInnerHTML={{ __html: renderEntryList(entity, rows) }}
        />
      )}

      {hasMore && (
        <div className="entry-more-wrap">
          <a className="entry-more" href={moreHref}>
            Show more
          </a>
          <div data-entry-sentinel data-slug={slug} data-next={page + 1} hidden />
        </div>
      )}
    </div>
  );
}
