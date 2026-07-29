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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot: bots fill _hp, humans leave it empty — mirrors the central
  // relay's own check (platform/apps/web's forms/submit route).
  if (body._hp) {
    return NextResponse.json({ ok: true });
  }

  const localResult = await tryLocalDelivery(slug, body);
  if (localResult) return NextResponse.json(localResult.body, { status: localResult.status });

  return forwardToCentralRelay(slug, body);
}

async function tryLocalDelivery(
  slug: string,
  fields: Record<string, unknown>
): Promise<{ body: unknown; status: number } | null> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const cellpyApiToken = process.env.CELLPY_API_TOKEN;
  if (!resendApiKey || !cellpyApiToken) return null;

  try {
    const destRes = await fetch(`${CENTRAL_DESTINATION_BASE}${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${cellpyApiToken}` },
    });
    if (!destRes.ok) return null;
    const { email } = (await destRes.json()) as { email: string | null };
    if (!email) return null;

    const [row] = await db
      .select({ pageTitle: pages.title, pageSlug: pages.slug })
      .from(containers)
      .innerJoin(pages, eq(containers.pageId, pages.id))
      .where(eq(containers.cellpyContainerSlug, slug))
      .limit(1);

    const pageTitle = row?.pageTitle ?? slug;
    const pageUrl = row?.pageSlug ? `https://${process.env.VERCEL_URL ?? ""}/${row.pageSlug}` : "";

    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: email,
      subject: `New submission — ${pageTitle}`,
      html: formatEmailHtml(pageTitle, pageUrl, fields),
      text: formatEmailText(fields),
    });
    if (error) return null;

    return { body: { ok: true }, status: 200 };
  } catch {
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
