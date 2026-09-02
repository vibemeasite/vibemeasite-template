import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  clampPage,
  readQ,
  readSort,
  readFacets,
  facetParamName,
  withParams,
  buildEntriesWhere,
  resolveOrderBy,
  type EntityLite,
} from "./entries-query";

// The point of this file: prove that nothing an HTTP client sends
// (?q, ?sort, ?f_<key>, ?page) can reach the SQL as anything other than a
// bound parameter, and that the ORDER BY column / data_json key come only
// from the entity's own field schema.

const dialect = new PgDialect();
const render = (sql: SQL) => dialect.sqlToQuery(sql);

const entity: EntityLite = {
  slug: "people",
  name: "Person",
  pluralLabel: "People",
  fields: [
    { key: "headline", label: "Name", type: "text", searchable: true },
    { key: "group", label: "Group", type: "select", filterable: true, options: ["a", "b"] },
    { key: "role", label: "Role", type: "text", filterable: true },
    { key: "tags", label: "Tags", type: "tags", filterable: true },
    { key: "years", label: "Years", type: "number" },
  ],
  layout: "card",
  defaultSort: "newest",
  pageSize: 24,
  template: null,
};

describe("clampPage", () => {
  it("only ever returns an integer in [1, 10000]", () => {
    expect(clampPage("3")).toBe(3);
    expect(clampPage("-1")).toBe(1);
    expect(clampPage("0")).toBe(1);
    expect(clampPage("1e9")).toBe(1);
    expect(clampPage("10001")).toBe(1);
    expect(clampPage("10000")).toBe(10000);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage("3; DROP TABLE entries")).toBe(1); // trailing garbage rejected
    expect(clampPage(" 4 ")).toBe(4);
  });
});

describe("readQ", () => {
  it("trims, length-gates 2..80, takes the first value", () => {
    expect(readQ({ q: "a" })).toBeUndefined();
    expect(readQ({ q: "  ab  " })).toBe("ab");
    expect(readQ({ q: "x".repeat(81) })).toBeUndefined();
    expect(readQ({ q: ["marketing", "junk"] })).toBe("marketing");
    expect(readQ({ q: "" })).toBeUndefined();
    expect(readQ({})).toBeUndefined();
  });
});

describe("readSort", () => {
  it("accepts newest/oldest or a real field key, else newest", () => {
    expect(readSort(entity, { sort: "newest" })).toBe("newest");
    expect(readSort(entity, { sort: "oldest" })).toBe("oldest");
    expect(readSort(entity, { sort: "headline" })).toBe("headline");
    expect(readSort(entity, { sort: "id; DROP TABLE entries" })).toBe("newest");
    expect(readSort(entity, { sort: "created_at" })).toBe("newest"); // not a declared field
    expect(readSort(entity, {})).toBe("newest");
  });
});

describe("readFacets", () => {
  it("keeps only filterable field keys, prefixed f_, values <= 120 chars", () => {
    expect(
      readFacets(entity, {
        f_group: "a",
        f_role: "dev",
        f_headline: "x", // headline isn't filterable
        f_tags: "t",
        f_bogus: "y",
        role: "unprefixed-ignored",
      }),
    ).toEqual({ group: "a", role: "dev", tags: "t" });

    expect(readFacets(entity, { f_role: "z".repeat(121) })).toEqual({});
  });

  it("facetParamName prefixes", () => {
    expect(facetParamName("group")).toBe("f_group");
  });
});

describe("buildEntriesWhere", () => {
  it("base clause is entity_slug + status, both bound", () => {
    const { sql, params } = render(buildEntriesWhere(entity, undefined, {}));
    expect(params).toEqual(["people", "published"]);
    expect(sql).not.toMatch(/people/); // slug is a param, not inlined
  });

  it("escapes LIKE metacharacters in q and binds the whole pattern", () => {
    const { sql, params } = render(buildEntriesWhere(entity, "50%_\\x", {}));
    expect(params).toEqual(["people", "published", "%50\\%\\_\\\\x%"]);
    expect(sql).toMatch(/ILIKE/i);
    expect(sql).toContain("ESCAPE");
  });

  it("a SQL-injection-shaped q is a single bound value, not structure", () => {
    const { sql, params } = render(buildEntriesWhere(entity, "a' OR 1=1--", {}));
    expect(params[2]).toBe("%a' or 1=1--%");
    expect(sql.toLowerCase()).not.toContain(" or 1=1");
    expect(params).toHaveLength(3);
  });

  it("scalar facet -> (data_json ->> $key) = $val, both bound", () => {
    const { sql, params } = render(buildEntriesWhere(entity, undefined, { group: "a" }));
    expect(params).toEqual(["people", "published", "group", "a"]);
    expect(sql).toContain("->>");
  });

  it("malicious facet value is a bound param, not structure", () => {
    const { sql, params } = render(
      buildEntriesWhere(entity, undefined, { role: "y' OR '1'='1" }),
    );
    expect(params).toContain("y' OR '1'='1");
    expect(sql.toLowerCase()).not.toContain("or '1'='1");
  });

  it("tags facet uses jsonb containment with a bound json param", () => {
    const { sql, params } = render(buildEntriesWhere(entity, undefined, { tags: "calgary" }));
    expect(params).toContain('{"tags":["calgary"]}');
    expect(sql).toContain("@>");
  });

  it("ignores a facet key that isn't a filterable field", () => {
    const { params } = render(buildEntriesWhere(entity, undefined, { headline: "x", nope: "y" }));
    expect(params).toEqual(["people", "published"]);
  });
});

describe("resolveOrderBy", () => {
  it("newest / oldest map to created_at direction", () => {
    expect(render(resolveOrderBy(entity, "newest")).sql).toMatch(/created_at.*desc/i);
    expect(render(resolveOrderBy(entity, "oldest")).sql).toMatch(/created_at.*asc/i);
  });

  it("a real field key sorts by that data_json key, bound", () => {
    const { sql, params } = render(resolveOrderBy(entity, "headline"));
    expect(sql).toContain("->>");
    expect(params).toEqual(["headline"]);
  });

  it("an unknown / injection sort key falls back to created_at desc", () => {
    const { sql, params } = render(resolveOrderBy(entity, "id; DROP TABLE entries"));
    expect(sql).toMatch(/created_at.*desc/i);
    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(params).toEqual([]);
  });
});

describe("withParams", () => {
  it("merges overrides, drops empties, returns a leading-? query string", () => {
    expect(withParams({ q: "x", page: "2" }, { page: 3 })).toBe("?q=x&page=3");
    expect(withParams({ q: "x" }, { page: undefined })).toBe("?q=x");
    expect(withParams({}, {})).toBe("");
    expect(withParams({ f_group: "a" }, { page: 2 })).toBe("?f_group=a&page=2");
  });
});
