import type { EntityLite, EntityFieldLite } from "./entries-query";

// BSA Phase 16 — the preset renderer. Turns a validated entry row's
// data_json into a fixed class-contract HTML string (all values escaped),
// styled centrally by app/globals.css's `.entry*` rules — same
// trusted-CSS-against-a-contract posture as the booking widget / cookie
// banner. `entity.template` (an author HTML override) is deferred; v1
// always uses this.

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

type Slot = "title" | "body" | "media" | "actions" | "meta";

function slotFor(field: EntityFieldLite, isFirstText: boolean): Slot {
  if (field.role === "title") return "title";
  if (field.role === "body") return "body";
  if (field.role === "media") return "media";
  if (field.role === "actions") return "actions";
  if (field.role === "meta") return "meta";
  if (field.type === "image") return "media";
  if (field.type === "url") return "actions";
  if (field.type === "textarea") return "body";
  if (field.type === "text" && isFirstText) return "title";
  return "meta";
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── optional entity.template renderer (escaped mustache-subset) ──────────
// {{key}} / {{this}} / {{.}} / {{@index}}  — escaped scalar (arrays join ", ")
// {{#each key}}…{{/each}}                   — iterate an array field
// {{#if key}}…{{/if}}                        — render when the field is truthy
// Validated on the vibemeasite-mcp side (lib/entry-template.ts) before it's
// ever stored; this renderer still hard-caps output and depth and throws on
// anything unexpected, so renderEntry falls back to the preset on any miss.

type Ctx = Record<string, unknown>;

const MUSTACHE_MAX_DEPTH = 8;
const MUSTACHE_MAX_OUTPUT = 16000;

function isTruthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (typeof v === "string") return v.trim() !== "";
  return Boolean(v);
}

function scalar(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return "";
  return String(v);
}

// First balanced {{#kw arg}} … {{/kw}} section, honouring nesting of the
// same keyword. Returns null when there's no opener.
function matchSection(tpl: string, kw: "each" | "if"): { before: string; arg: string; body: string; after: string } | null {
  const openRe = new RegExp(`\\{\\{#${kw}\\s+([a-z][a-z0-9_]*)\\}\\}`, "g");
  const open = openRe.exec(tpl);
  if (!open) return null;
  const close = `{{/${kw}}}`;
  const openTag = `{{#${kw} `;
  let depth = 1;
  let i = openRe.lastIndex;
  while (i < tpl.length) {
    const nextOpen = tpl.indexOf(openTag, i);
    const nextClose = tpl.indexOf(close, i);
    if (nextClose === -1) throw new Error("unbalanced section");
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) {
        return {
          before: tpl.slice(0, open.index),
          arg: open[1],
          body: tpl.slice(openRe.lastIndex, nextClose),
          after: tpl.slice(nextClose + close.length),
        };
      }
      i = nextClose + close.length;
    }
  }
  throw new Error("unbalanced section");
}

function renderMustache(tpl: string, ctx: Ctx, depth: number): string {
  if (depth > MUSTACHE_MAX_DEPTH) throw new Error("template too deeply nested");

  // #each (outermost first)
  const each = matchSection(tpl, "each");
  if (each) {
    const list = ctx[each.arg];
    let mid = "";
    if (Array.isArray(list)) {
      list.forEach((el, idx) => {
        mid += renderMustache(each.body, { ...ctx, this: el, ".": el, "@index": idx }, depth + 1);
      });
    }
    const out = renderMustache(each.before, ctx, depth + 1) + mid + renderMustache(each.after, ctx, depth + 1);
    if (out.length > MUSTACHE_MAX_OUTPUT) throw new Error("template output too large");
    return out;
  }

  // #if
  const iff = matchSection(tpl, "if");
  if (iff) {
    const mid = isTruthy(ctx[iff.arg]) ? renderMustache(iff.body, ctx, depth + 1) : "";
    const out = renderMustache(iff.before, ctx, depth + 1) + mid + renderMustache(iff.after, ctx, depth + 1);
    if (out.length > MUSTACHE_MAX_OUTPUT) throw new Error("template output too large");
    return out;
  }

  // scalars — {{key}} / {{this}} / {{.}} / {{@index}}
  return tpl.replace(/\{\{\s*([a-z][a-z0-9_]*|this|\.|@index)\s*\}\}/gi, (_m, key) => esc(scalar(ctx[key])));
}

function renderWithTemplate(template: string, ctx: Ctx): string {
  const out = renderMustache(template, ctx, 0);
  if (out.length > MUSTACHE_MAX_OUTPUT) throw new Error("template output too large");
  return out;
}

export interface EntryRow {
  id: string;
  dataJson: Record<string, unknown> | unknown;
  createdAt: string | Date;
}

export function renderEntry(entity: EntityLite, row: EntryRow): string {
  const data = (row.dataJson && typeof row.dataJson === "object" ? row.dataJson : {}) as Record<string, unknown>;
  const created = monthYear(typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString());

  // Optional author HTML override. Validated on the vibemeasite-mcp side;
  // any render-time miss falls back to the preset renderer below.
  if (typeof entity.template === "string" && entity.template.trim()) {
    try {
      const html = renderWithTemplate(entity.template, { ...data, added: created, id: row.id });
      if (html.trim()) return html;
    } catch {
      /* fall through to preset */
    }
  }

  let firstTextSeen = false;

  const title: string[] = [];
  const body: string[] = [];
  const media: string[] = [];
  const actions: string[] = [];
  const meta: string[] = [];

  for (const field of entity.fields) {
    const value = data[field.key];
    const isFirstText = field.type === "text" && !firstTextSeen;
    if (field.type === "text") firstTextSeen = true;

    if (value === undefined || value === null || value === "") continue;
    const slot = slotFor(field, isFirstText);

    if (slot === "title") {
      title.push(`<h3 class="entry__title">${esc(value)}</h3>`);
      continue;
    }
    if (slot === "body") {
      body.push(`<p class="entry__body">${esc(value)}</p>`);
      continue;
    }
    if (slot === "media") {
      const href = typeof value === "string" ? safeHref(value) : null;
      if (href) {
        media.push(`<img class="entry__media" src="${esc(href)}" alt="" loading="lazy" decoding="async" />`);
      }
      continue;
    }
    if (slot === "actions") {
      const href = typeof value === "string" ? safeHref(value) : null;
      if (href) {
        actions.push(`<a class="entry__action" href="${esc(href)}" rel="noopener nofollow" target="_blank">${esc(field.label)}</a>`);
      }
      continue;
    }

    // meta
    if (field.type === "tags" && Array.isArray(value)) {
      const chips = value
        .map((t) => `<span class="entry__tag">${esc(t)}</span>`)
        .join("");
      if (chips) meta.push(`<div class="entry__tags">${chips}</div>`);
      continue;
    }
    if (field.type === "email") {
      meta.push(
        `<div class="entry__meta-row"><span class="entry__meta-label">${esc(field.label)}</span> <a class="entry__meta-value" href="mailto:${esc(value)}">${esc(value)}</a></div>`,
      );
      continue;
    }
    if (field.type === "tel") {
      meta.push(
        `<div class="entry__meta-row"><span class="entry__meta-label">${esc(field.label)}</span> <a class="entry__meta-value" href="tel:${esc(String(value).replace(/[^+0-9]/g, ""))}">${esc(value)}</a></div>`,
      );
      continue;
    }
    meta.push(
      `<div class="entry__meta-row"><span class="entry__meta-label">${esc(field.label)}</span> <span class="entry__meta-value">${esc(value)}</span></div>`,
    );
  }

  const byline = created ? `<p class="entry__byline">Added ${esc(created)}</p>` : "";

  return (
    `<article class="entry">` +
    media.join("") +
    `<div class="entry__text">` +
    title.join("") +
    body.join("") +
    (meta.length ? `<div class="entry__meta">${meta.join("")}</div>` : "") +
    (actions.length ? `<div class="entry__actions">${actions.join("")}</div>` : "") +
    byline +
    `</div>` +
    `</article>`
  );
}

export function renderEntryList(entity: EntityLite, rows: EntryRow[]): string {
  return rows.map((r) => renderEntry(entity, r)).join("");
}
