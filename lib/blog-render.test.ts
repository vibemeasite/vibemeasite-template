import { describe, it, expect } from "vitest";
import { isPublished, plainTextExcerpt, buildRssXml, buildBlogQueryString } from "./blog-render";

describe("buildBlogQueryString", () => {
  it("preserves every value of a multi-valued param (the bug withParams had)", () => {
    const qs = buildBlogQueryString({ tags: ["a", "b", "c"] }, { page: 2 });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.getAll("tags")).toEqual(["a", "b", "c"]);
    expect(params.get("page")).toBe("2");
  });

  it("an override fully replaces the existing key rather than appending", () => {
    const qs = buildBlogQueryString({ page: "3" }, { page: 5 });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.getAll("page")).toEqual(["5"]);
  });

  it("drops empty-string values from both source params and overrides", () => {
    const qs = buildBlogQueryString({ q: "", tags: ["x", ""] }, { category: "" });
    expect(qs).toBe("?tags=x");
  });

  it("returns an empty string when there is nothing to encode", () => {
    expect(buildBlogQueryString({}, {})).toBe("");
  });
});

describe("isPublished (must agree with vibemeasite-mcp's lib/blog-format.ts copy)", () => {
  it("draft is never published regardless of publishedAt", () => {
    expect(isPublished({ status: "draft", publishedAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
  it("published with a future publishedAt is not yet visible", () => {
    expect(isPublished({ status: "published", publishedAt: new Date(Date.now() + 100000).toISOString() })).toBe(false);
  });
  it("published with a past publishedAt is visible", () => {
    expect(isPublished({ status: "published", publishedAt: new Date(Date.now() - 100000).toISOString() })).toBe(true);
  });
  it("scheduled with a past publishedAt is visible", () => {
    expect(isPublished({ status: "scheduled", publishedAt: new Date(Date.now() - 100000).toISOString() })).toBe(true);
  });
  it("null/undefined post is never published", () => {
    expect(isPublished(null)).toBe(false);
    expect(isPublished(undefined)).toBe(false);
  });
});

describe("plainTextExcerpt", () => {
  it("strips tags and collapses whitespace", () => {
    expect(plainTextExcerpt("<p>Hello   <b>world</b></p>", 200)).toBe("Hello world");
  });
  it("truncates at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(100).trim();
    const r = plainTextExcerpt(long, 20);
    expect(r.endsWith("…")).toBe(true);
    expect(r.length).toBeLessThanOrEqual(22);
    expect(r.slice(0, -1).endsWith(" ")).toBe(false);
  });
});

describe("buildRssXml", () => {
  it("escapes special characters in title/description/link", () => {
    const xml = buildRssXml({
      siteName: "A & B",
      baseUrl: "https://example.com",
      posts: [{
        title: 'Hello <World> & "Friends"',
        url: "https://example.com/blog/hello",
        publishedAt: new Date().toISOString(),
        description: "5 < 10 & true",
        tags: ["a&b"],
      }],
    });
    expect(xml).toContain("Hello &lt;World&gt; &amp; &quot;Friends&quot;");
    expect(xml).toContain("5 &lt; 10 &amp; true");
    expect(xml).toContain("<category>a&amp;b</category>");
    expect(xml).not.toContain("<World>");
  });

  it("produces a valid item even with no description", () => {
    const xml = buildRssXml({
      siteName: "Site",
      baseUrl: "https://example.com",
      posts: [{ title: "No excerpt", url: "https://example.com/blog/no-excerpt", publishedAt: new Date().toISOString(), description: "", tags: [] }],
    });
    expect(xml).toContain("<title>No excerpt</title>");
    expect(xml).toContain("<item>");
  });
});
