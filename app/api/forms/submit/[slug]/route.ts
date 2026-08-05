import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../../../../../db/index";
import { containers, pages } from "../../../../../db/schema";

// Same-origin form submission (fixes the CORS class of bug entirely — see
// public/forms.js, which now posts here instead of cross-origin to
// cellpy.com). Tries local delivery via the Site Owner's own Resend account
// (set up with connect_resend); falls back to forwarding server-to-server
// to Cellpy's central relay — server-to-server calls aren't subject to CORS
// at all — whenever local delivery isn't configured or fails for any
// reason. This is what keeps staging sites (never configured) and claimed
// sites mid-setup working exactly as before.
const CENTRAL_RELAY_BASE = "https://www.cellpy.com/api/forms/submit/";
const CENTRAL_DESTINATION_BASE = "https://www.cellpy.com/api/forms/destination/";
const CENTRAL_ATTACHMENTS_BASE = "https://www.cellpy.com/api/forms/attachments";

// The browser uploads files directly to the CDN Worker (see public/forms.js
// and platform/workers/cdn/src/index.ts's handleFormUpload) — bypassing
// this Vercel function's request-body ceiling entirely, since a single
// 10MB image would blow past it. What arrives here is just the resulting R2
// key, not bytes; ResolvedAttachment (with real content) only exists after
// fetchAttachmentContent pulls it back via the central platform in
// tryLocalDelivery, right before handing it to Resend.
interface PendingAttachment {
  filename: string;
  contentType: string;
  key: string;
}
interface ResolvedAttachment {
  filename: string;
  contentType: string;
  content: string; // base64, no data: prefix
}

// Images/PDF/Word docs only — matches what the "Get a Quote"-style forms
// this is built for actually need. Mirrors the CDN Worker's own copy of
// this constant (platform/workers/cdn/src/index.ts).
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "doc", "docx",
]);
const MAX_ATTACHMENTS = 4;
const R2_KEY_RE = /^form-uploads\/[a-z0-9-]{1,64}\/[a-f0-9-]{36}-[a-zA-Z0-9._-]+$/;

type AttachmentValidation =
  | { ok: true; attachments: PendingAttachment[] }
  | { ok: false; message: string };

function validateAttachments(raw: unknown, slug: string): AttachmentValidation {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, message: "Invalid attachment data." };
  if (raw.length > MAX_ATTACHMENTS) {
    return { ok: false, message: `You can attach up to ${MAX_ATTACHMENTS} files.` };
  }

  const attachments: PendingAttachment[] = [];

  for (const item of raw) {
    const filename = (item as { filename?: unknown })?.filename;
    const key = (item as { key?: unknown })?.key;
    const contentType = (item as { contentType?: unknown })?.contentType;
    if (typeof filename !== "string" || typeof key !== "string") {
      return { ok: false, message: "Invalid attachment data." };
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
      return { ok: false, message: `"${filename}" isn't an accepted file type — images, PDF, or Word docs only.` };
    }
    if (!R2_KEY_RE.test(key) || !key.startsWith(`form-uploads/${slug}/`)) {
      return { ok: false, message: "Invalid attachment data." };
    }

    attachments.push({
      filename,
      key,
      contentType: typeof contentType === "string" ? contentType : "application/octet-stream",
    });
  }

  return { ok: true, attachments };
}

// Pulls the real bytes back from R2 via the central platform (which holds
// the Cloudflare credentials — per-site deployments never get those) and
// consumes them: the central endpoint deletes each object right after a
// successful read, since R2 is transient staging here, not storage.
async function fetchAttachmentContent(
  slug: string,
  pending: PendingAttachment[],
  cellpyApiToken: string
): Promise<ResolvedAttachment[] | null> {
  if (pending.length === 0) return [];
  try {
    const res = await fetch(CENTRAL_ATTACHMENTS_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cellpyApiToken}`,
      },
      body: JSON.stringify({ slug, keys: pending.map((a) => a.key) }),
    });
    if (!res.ok) {
      console.error(`[forms] attachment fetch failed for "${slug}": ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }
    const { attachments } = (await res.json()) as {
      attachments: { key: string; filename: string; contentType: string; content: string }[];
    };
    return attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content }));
  } catch (err) {
    console.error(`[forms] attachment fetch threw for "${slug}":`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot: bots fill _hp, humans leave it empty — mirrors the central
  // relay's own check (platform/apps/web's forms/submit route).
  if (rawBody._hp) {
    return NextResponse.json({ ok: true });
  }

  const { _hp: _ignoredHp, _attachments, ...fields } = rawBody;

  const attachmentResult = validateAttachments(_attachments, slug);
  if (!attachmentResult.ok) {
    return NextResponse.json(
      { ok: false, error: "ATTACHMENT_INVALID", message: attachmentResult.message },
      { status: 400 }
    );
  }

  const localResult = await tryLocalDelivery(slug, fields, attachmentResult.attachments);
  if (localResult) return NextResponse.json(localResult.body, { status: localResult.status });

  // Attachments only ever go out via the Site Owner's own Resend account
  // (connect_resend) — the central relay's JSON contract has no attachment
  // support, and silently forwarding text-only would mean the visitor's
  // files just vanish with no error. Fail loudly instead so they know to
  // retry rather than assume it worked.
  if (attachmentResult.attachments.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "ATTACHMENTS_UNAVAILABLE",
        message: "Files couldn't be sent right now — please try again shortly, or resubmit without attachments.",
      },
      { status: 503 }
    );
  }

  return forwardToCentralRelay(slug, fields);
}

async function tryLocalDelivery(
  slug: string,
  fields: Record<string, unknown>,
  pendingAttachments: PendingAttachment[]
): Promise<{ body: unknown; status: number } | null> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const cellpyApiToken = process.env.CELLPY_API_TOKEN;
  if (!resendApiKey || !cellpyApiToken) return null;

  try {
    const destRes = await fetch(`${CENTRAL_DESTINATION_BASE}${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${cellpyApiToken}` },
    });
    if (!destRes.ok) {
      console.error(`[forms] destination lookup failed for "${slug}": ${destRes.status} ${await destRes.text().catch(() => "")}`);
      return null;
    }
    const { emails } = (await destRes.json()) as { emails: string[] };
    if (!emails || emails.length === 0) {
      console.error(`[forms] destination lookup for "${slug}" returned no email`);
      return null;
    }

    const attachments = await fetchAttachmentContent(slug, pendingAttachments, cellpyApiToken);
    if (attachments === null) return null;

    const [row] = await db
      .select({ pageTitle: pages.title, pageSlug: pages.slug })
      .from(containers)
      .innerJoin(pages, eq(containers.pageId, pages.id))
      .where(eq(containers.cellpyContainerSlug, slug))
      .limit(1);

    const pageTitle = row?.pageTitle ?? slug;
    const pageUrl = row?.pageSlug ? `https://${process.env.VERCEL_URL ?? ""}/${row.pageSlug}` : "";

    // Listed as a regular field too (not just as real email attachments) so
    // it's visible when scanning the email body without opening each file.
    const emailFields = attachments.length > 0
      ? { ...fields, Attachments: attachments.map((a) => a.filename).join(", ") }
      : fields;

    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: emails,
      subject: `New submission — ${pageTitle}`,
      html: formatEmailHtml(pageTitle, pageUrl, emailFields),
      text: formatEmailText(emailFields),
      attachments: attachments.length > 0
        ? attachments.map((a) => ({ filename: a.filename, content: a.content }))
        : undefined,
    });
    if (error) {
      console.error(`[forms] Resend send failed for "${slug}":`, JSON.stringify(error));
      return null;
    }

    return { body: { ok: true }, status: 200 };
  } catch (err) {
    console.error(`[forms] local delivery threw for "${slug}":`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function forwardToCentralRelay(
  slug: string,
  fields: Record<string, unknown>
): Promise<NextResponse> {
  try {
    const res = await fetch(`${CENTRAL_RELAY_BASE}${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "RELAY_FAILED", message: "Something went wrong. Please try again." },
      { status: 502 }
    );
  }
}

// Ported from platform/apps/web/lib/form-relay.ts's relayEmail formatting —
// kept in sync by hand, same as forms.js documents doing for its own logic.
function formatEmailHtml(pageTitle: string, pageUrl: string, fields: Record<string, unknown>): string {
  const rows = Object.entries(fields)
    .filter(([k]) => k !== "_hp")
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
          <td style="padding:12px 16px 12px 28px;width:38%;font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#6b7280;vertical-align:top;word-break:break-word;border-bottom:1px solid #f1f5f9">${escapeHtml(k)}</td>
          <td style="padding:12px 28px 12px 16px;font-size:14px;color:#111827;vertical-align:top;word-break:break-word;border-bottom:1px solid #f1f5f9">${escapeHtml(String(v))}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:22px 28px">
      <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;margin-bottom:6px">New submission</div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff">${escapeHtml(pageTitle)}</h1>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;overflow:hidden">
      <table style="border-collapse:collapse;width:100%">
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
        <span style="font-size:11px;color:#94a3b8">Submitted ${new Date().toUTCString()}</span>
        ${pageUrl ? `&nbsp;·&nbsp;<a href="${escapeHtml(pageUrl)}" style="font-size:11px;color:#94a3b8;text-decoration:none">${escapeHtml(pageUrl)}</a>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatEmailText(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([k]) => k !== "_hp")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
