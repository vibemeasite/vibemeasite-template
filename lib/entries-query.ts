import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { entries } from "../db/schema";

// BSA Phase 16 — the ONE place a query against the `entries` table is
// constructed. Both <EntityList> (server component) and
// /api/entries/[slug] (route handler) go through here, so the injection
// rules can't drift:
//   • The ORDER BY column and every `data_json ->> <key>` key come ONLY
//     from the entity's own `fields` schema, resolved in-process — never
//     from a request string.
//   • Every value (`q`, facet values, page, pageSize) is a bound
//     parameter. `q`'s LIKE metacharacters are escaped.
//   • pageSize comes from the entity / mount marker, never the request.

export interface EntityFieldLite {
  key: string;
  label: string;
  type: string;
  role?: string;
  searchable?: boolean;
  filterable?: boolean;
  options?: string[];
}

export interface EntityLite {
  slug: string;
  name: string;
  pluralLabel: string | null;
  fields: EntityFieldLite[];
  layout: string;
  defaultSort: string;
  pageSize: number;
  template: string | null;
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

const FACET_PREFIX = "f_";

export function clampPage(raw: unknown): number {
  const s = String(raw ?? "1").trim();
  if (!/^\d{1,5}$/.test(s)) return 1; // reject "1e9", "3; drop…", etc. outright
  const n = Number.parseInt(s, 10);
  return n >= 1 && n <= 10000 ? n : 1;
}

function firstStr(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.length > 0 ? s : undefined;
}

export function readQ(sp: SearchParamsRecord): string | undefined {
  const q = firstStr(sp.q);
  if (!q) return undefined;
  const t = q.trim();
  return t.length >= 2 && t.length <= 80 ? t : undefined;
}

export function readSort(entity: EntityLite, sp: SearchParamsRecord): string {
  const raw = firstStr(sp.sort);
  const candidate = (raw ?? entity.defaultSort ?? "newest").trim();
  if (candidate === "newest" || candidate === "oldest") return candidate;
  return entity.fields.some((f) => f.key === candidate) ? candidate : "newest";
}

// Only fields the entity itself marks filterable, and only values within a
// sane length. The param name is prefixed (`f_<key>`) so it can never
// collide with `q` / `page` / `sort`.
export function readFacets(entity: EntityLite, sp: SearchParamsRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of entity.fields) {
    if (!f.filterable) continue;
    const v = firstStr(sp[FACET_PREFIX + f.key]);
    if (v && v.length <= 120) out[f.key] = v;
  }
  return out;
}

export function facetParamName(key: string): string {
  return FACET_PREFIX + key;
}

export function buildEntriesWhere(entity: EntityLite, q: string | undefined, facets: Record<string, string>): SQL {
  const clauses: (SQL | undefined)[] = [
    eq(entries.entitySlug, entity.slug),
    eq(entries.status, "published"),
  ];

  if (q) {
    // Escape LIKE metacharacters so a literal % / _ / \ in the query isn't
    // a wildcard; ESCAPE '\' names the escape char explicitly.
    const esc = q.toLowerCase().replace(/[\\%_]/g, (s) => "\\" + s);
    clauses.push(sql`${entries.searchText} ILIKE ${"%" + esc + "%"} ESCAPE '\\'`);
  }

  for (const [key, val] of Object.entries(facets)) {
    const field = entity.fields.find((f) => f.key === key && f.filterable);
    if (!field) continue; // key is from the schema, but re-check defensively
    if (field.type === "tags") {
      // data_json contains { "<key>": [ "<val>", ... ] }
      clauses.push(sql`${entries.dataJson} @> ${JSON.stringify({ [key]: [val] })}::jsonb`);
    } else {
      clauses.push(sql`(${entries.dataJson} ->> ${key}) = ${val}`);
    }
  }

  return and(...clauses)!;
}

export function resolveOrderBy(entity: EntityLite, sortKey: string): SQL {
  if (sortKey === "oldest") return asc(entries.createdAt);
  if (sortKey === "newest") return desc(entries.createdAt);
  const field = entity.fields.find((f) => f.key === sortKey);
  if (!field) return desc(entries.createdAt);
  // key is one of the entity's own field keys — safe to interpolate as a
  // bound param into the JSON path.
  return sql`(${entries.dataJson} ->> ${sortKey}) asc`;
}

// Rebuilds the current query string with one override applied (used for the
// "?page=N" no-JS pager link). Drops empty values.
export function withParams(sp: SearchParamsRecord, overrides: Record<string, string | number | undefined>): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const s = firstStr(v);
    if (s) merged[k] = s;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete merged[k];
    else merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged).toString();
  return qs ? `?${qs}` : "";
}
