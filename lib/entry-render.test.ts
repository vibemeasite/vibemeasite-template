import { describe, it, expect } from "vitest";
import { renderEntry } from "./entry-render";
import type { EntityLite } from "./entries-query";

const base: EntityLite = {
  slug: "people",
  name: "Person",
  pluralLabel: "People",
  fields: [
    { key: "headline", label: "Name", type: "text", role: "title" },
    { key: "bio", label: "Bio", type: "textarea" },
    { key: "site", label: "Site", type: "url" },
    { key: "tags", label: "Tags", type: "tags" },
  ],
  layout: "card",
  defaultSort: "newest",
  pageSize: 24,
  template: null,
};

const row = (data: Record<string, unknown>) => ({
  id: "e1",
  dataJson: data,
  createdAt: "2026-03-15T12:00:00.000Z",
});

describe("preset renderer", () => {
  it("HTML-escapes every interpolated field value", () => {
    const html = renderEntry(base, row({ headline: `<script>alert(1)</script>`, bio: `a & b " c` }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &quot; c");
  });

  it("only emits http(s) hrefs for url fields", () => {
    expect(renderEntry(base, row({ headline: "x", site: "javascript:alert(1)" }))).not.toContain("javascript:");
    expect(renderEntry(base, row({ headline: "x", site: "https://ok.example/x" }))).toContain('href="https://ok.example/x"');
  });

  it("renders tags as escaped chips", () => {
    const html = renderEntry(base, row({ headline: "x", tags: ["a<b", "c"] }));
    expect(html).toContain("a&lt;b");
    expect(html).toContain('class="entry__tag"');
  });
});

describe("entity.template override", () => {
  const withTpl = (template: string): EntityLite => ({ ...base, template });

  it("interpolates escaped values and supports #if / #each", () => {
    const html = renderEntry(
      withTpl(`<div class="c">{{headline}}{{#if bio}}<p>{{bio}}</p>{{/if}}{{#each tags}}<i>{{this}}</i>{{/each}}</div>`),
      row({ headline: "Maria", bio: "hi", tags: ["x", "y"] }),
    );
    expect(html).toBe(`<div class="c">Maria<p>hi</p><i>x</i><i>y</i></div>`);
  });

  it("escapes a hostile value inside the template", () => {
    const html = renderEntry(
      withTpl(`<div>{{headline}}</div>`),
      row({ headline: `</div><script>x</script>` }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("handles an #each nested inside an #if (and vice versa)", () => {
    const tpl = `<div>{{#if tags}}<p>Looking for: {{#each tags}}<span>{{this}}</span> {{/each}}</p>{{/if}}</div>`;
    expect(renderEntry(withTpl(tpl), row({ headline: "x", tags: ["a", "b"] }))).toBe(
      `<div><p>Looking for: <span>a</span> <span>b</span> </p></div>`,
    );
    expect(renderEntry(withTpl(tpl), row({ headline: "x" }))).toBe(`<div></div>`);

    const tpl2 = `<ul>{{#each tags}}<li>{{#if headline}}{{headline}}: {{/if}}{{this}}</li>{{/each}}</ul>`;
    expect(renderEntry(withTpl(tpl2), row({ headline: "M", tags: ["a"] }))).toBe(`<ul><li>M: a</li></ul>`);
  });

  it("omits an #if block when the field is falsy/empty", () => {
    const html = renderEntry(withTpl(`<div>{{headline}}{{#if bio}}[{{bio}}]{{/if}}</div>`), row({ headline: "x" }));
    expect(html).toBe(`<div>x</div>`);
  });

  it("falls back to the preset renderer when the template throws", () => {
    // Unbalanced section -> matchSection throws -> preset renderer used.
    const html = renderEntry(withTpl(`<div>{{#each tags}}<i>{{this}}</i></div>`), row({ headline: "Fallback Name" }));
    expect(html).toContain('class="entry"'); // preset markup
    expect(html).toContain("Fallback Name");
  });
});
