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

export interface EntryRow {
  id: string;
  dataJson: Record<string, unknown> | unknown;
  createdAt: string | Date;
}

export function renderEntry(entity: EntityLite, row: EntryRow): string {
  const data = (row.dataJson && typeof row.dataJson === "object" ? row.dataJson : {}) as Record<string, unknown>;
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

  const created = monthYear(typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString());
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
