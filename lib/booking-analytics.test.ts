import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

// GA4 booking funnel (template v56) — public/vms-analytics.js (the shared
// tracking helper) and the booking_* events public/booking.js emits through
// it. Both are plain browser scripts, so each test runs them inside a fresh
// JSDOM window (full isolation: their document-level listeners and init
// guards never leak between tests).
const ANALYTICS_SRC = readFileSync(fileURLToPath(new URL("../public/vms-analytics.js", import.meta.url)), "utf8");
const BOOKING_SRC = readFileSync(fileURLToPath(new URL("../public/booking.js", import.meta.url)), "utf8");

type Win = JSDOM["window"] & Record<string, any>;

function makeWindow(opts: { gtm?: boolean; ga?: boolean; analytics?: boolean; html?: string; url?: string } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${opts.html ?? ""}</body></html>`, {
    url: opts.url ?? "https://example.com/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window as Win;
  const gtagCalls: unknown[][] = [];
  if (opts.ga) win.gtag = (...args: unknown[]) => gtagCalls.push(args);
  if (opts.gtm) win.dataLayer = [];
  if (opts.analytics !== false && (opts.gtm || opts.ga)) {
    win.__vmsAnalytics = { gtm: Boolean(opts.gtm), ga: Boolean(opts.ga) };
    win.eval(ANALYTICS_SRC);
  }
  return { win, gtagCalls };
}

// Every booking_* event, in order, regardless of transport.
function events(win: Win, gtagCalls: unknown[][]): Array<{ name: string; params: Record<string, unknown> }> {
  if (win.__vmsAnalytics?.gtm) {
    return (win.dataLayer as Array<Record<string, unknown>>)
      .filter((m) => typeof m.event === "string")
      .map(({ event, ...params }) => ({ name: event as string, params }));
  }
  return gtagCalls.map((c) => ({ name: c[1] as string, params: c[2] as Record<string, unknown> }));
}
const names = (evs: Array<{ name: string }>) => evs.map((e) => e.name);

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("vms-analytics.js — trackBookingEvent helper", () => {
  it("pushes { event, ...params } to dataLayer when GTM is configured", () => {
    const { win } = makeWindow({ gtm: true });
    win.vmsBookingAnalytics.track("booking_view", { widget_id: "w1" });
    expect(win.dataLayer).toEqual([{ event: "booking_view", widget_id: "w1" }]);
  });

  it("initializes dataLayer if it's missing (GTM configured)", () => {
    const { win } = makeWindow({ gtm: true });
    delete win.dataLayer;
    win.vmsBookingAnalytics.track("booking_view", { widget_id: "w1" });
    expect(win.dataLayer).toEqual([{ event: "booking_view", widget_id: "w1" }]);
  });

  it("falls back to gtag('event') when only GA4 is configured, without a dataLayer push", () => {
    const { win, gtagCalls } = makeWindow({ ga: true });
    win.vmsBookingAnalytics.track("booking_submit", { widget_id: "w1", service_name: "Cut" });
    expect(gtagCalls).toEqual([["event", "booking_submit", { widget_id: "w1", service_name: "Cut" }]]);
    expect(win.dataLayer).toBeUndefined();
  });

  it("does not double-fire when both GTM and GA4 are set — dataLayer only", () => {
    const { win, gtagCalls } = makeWindow({ gtm: true, ga: true });
    win.vmsBookingAnalytics.track("booking_view", { widget_id: "w1" });
    expect(win.dataLayer).toHaveLength(1);
    expect(gtagCalls).toHaveLength(0);
  });

  it("no-ops silently when neither GTM nor GA4 exists", () => {
    const { win } = makeWindow({ gtm: true });
    win.__vmsAnalytics.gtm = false; // config says nothing is present
    expect(() => win.vmsBookingAnalytics.track("booking_view", { widget_id: "w1" })).not.toThrow();
    expect(win.dataLayer).toEqual([]);
  });

  it("no-ops when GA4 is configured but gtag never loaded, and never throws if gtag throws", () => {
    const { win } = makeWindow({ ga: true });
    delete win.gtag;
    expect(() => win.vmsBookingAnalytics.track("booking_view", {})).not.toThrow();
    win.gtag = () => {
      throw new Error("boom");
    };
    expect(() => win.vmsBookingAnalytics.track("booking_view", {})).not.toThrow();
  });

  it("never sends PII — only allowlisted params pass, and any value containing @ is dropped", () => {
    const { win } = makeWindow({ gtm: true });
    win.vmsBookingAnalytics.track("booking_submit", {
      widget_id: "w1",
      service_name: "Cut",
      visitor_name: "Jane Doe",
      visitor_email: "jane@example.com",
      email: "jane@example.com",
      phone: "+1 555 0100",
      custom_field_values: { notes: "hi" },
      staff_name: "jane@example.com",
    });
    expect(win.dataLayer).toEqual([{ event: "booking_submit", widget_id: "w1", service_name: "Cut" }]);
  });

  it("ignores invalid event names", () => {
    const { win } = makeWindow({ gtm: true });
    win.vmsBookingAnalytics.track("Bad Name!", {});
    expect(win.dataLayer).toEqual([]);
  });

  it("conversion() fires booking_success followed by generate_lead with the same value/currency", () => {
    const { win } = makeWindow({ gtm: true });
    win.vmsBookingAnalytics.conversion({ widget_id: "w1", service_name: "Cut", value: 45, currency: "CAD", booking_id: "r1" });
    expect(win.dataLayer).toEqual([
      { event: "booking_success", widget_id: "w1", service_name: "Cut", value: 45, currency: "CAD", booking_id: "r1" },
      { event: "generate_lead", widget_id: "w1", value: 45, currency: "CAD", booking_id: "r1" },
    ]);
  });
});

describe("vms-analytics.js — booking_cta_click", () => {
  const WIDGET = `<main><section id="book" class="vms-booking-widget" data-cellpy-booking-widget="wpub"><div data-vms-booking-mount></div></section></main>`;

  it("fires immediately for a same-page #hash link to the widget, with cta_location and page_path", async () => {
    const { win } = makeWindow({
      gtm: true,
      url: "https://example.com/services",
      html: `<div class="nav-top"><a class="nav-cta" href="#book">Book</a></div>${WIDGET}`,
    });
    await flush();
    win.document.querySelector("a")!.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(win.dataLayer).toEqual([{ event: "booking_cta_click", cta_location: "header_cta", page_path: "/services", widget_id: "wpub" }]);
  });

  it("fires for a popup floating widget whose panel holds the booking widget", async () => {
    const { win } = makeWindow({
      gtm: true,
      html: `<div class="fw-bucket"><div class="fw-slot" data-fw-mode="popup" data-fw-widget-id="f1"><button data-cellpy-floating-widget>Book</button></div></div>
             <div id="fw-popup-f1" class="fw-popup" hidden><section data-cellpy-booking-widget="wpub"></section></div>`,
    });
    await flush();
    win.document.querySelector("button")!.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(win.dataLayer).toEqual([{ event: "booking_cta_click", cta_location: "floating", page_path: "/", widget_id: "wpub" }]);
  });

  it("does not fire for links that don't lead to a booking widget on this page", async () => {
    const { win } = makeWindow({ gtm: true, html: `<a href="#about">About</a><div id="about"></div>${WIDGET}` });
    await flush();
    win.document.querySelector("a")!.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(win.dataLayer).toEqual([]);
  });

  it("fires on the destination page for a cross-page link, only if that page has the widget", async () => {
    // Page 1 — click a section link to /book (navigation itself isn't performed by jsdom).
    const { win: home } = makeWindow({ gtm: true, url: "https://example.com/", html: `<main><a href="/book">Book now</a></main>` });
    await flush();
    home.document.querySelector("a")!.dispatchEvent(new home.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(home.dataLayer).toEqual([]);
    const record = home.sessionStorage.getItem("vms_booking_cta_click");
    expect(record).toBeTruthy();

    // Page 2 — /book, carrying the same tab's sessionStorage over.
    const dom = new JSDOM(`<!doctype html><body>${WIDGET}</body>`, { url: "https://example.com/book", runScripts: "outside-only" });
    const dest = dom.window as Win;
    dest.sessionStorage.setItem("vms_booking_cta_click", record!);
    dest.__vmsAnalytics = { gtm: true, ga: false };
    dest.dataLayer = [];
    dest.eval(ANALYTICS_SRC);
    await flush();
    expect(dest.dataLayer).toEqual([{ event: "booking_cta_click", cta_location: "section", page_path: "/", widget_id: "wpub" }]);
    expect(dest.sessionStorage.getItem("vms_booking_cta_click")).toBeNull();
  });

  it("drops a stale or mismatched cross-page record without firing", async () => {
    const dom = new JSDOM(`<!doctype html><body>${WIDGET}</body>`, { url: "https://example.com/book", runScripts: "outside-only" });
    const dest = dom.window as Win;
    dest.sessionStorage.setItem("vms_booking_cta_click", JSON.stringify({ path: "/other", location: "section", from: "/", t: Date.now() }));
    dest.__vmsAnalytics = { gtm: true, ga: false };
    dest.dataLayer = [];
    dest.eval(ANALYTICS_SRC);
    await flush();
    expect(dest.dataLayer).toEqual([]);
  });
});

describe("vms-analytics.js — /booking-confirmed (paid deposit conversion)", () => {
  async function confirmedPage(stash?: Record<string, unknown>, done = false) {
    const dom = new JSDOM(`<!doctype html><body></body>`, { url: "https://example.com/booking-confirmed?request_id=req1", runScripts: "outside-only" });
    const win = dom.window as Win;
    if (stash) win.sessionStorage.setItem("vms_booking_pending_req1", JSON.stringify(stash));
    if (done) win.localStorage.setItem("vms_booking_done_req1", "1");
    win.__vmsAnalytics = { gtm: true, ga: false };
    win.dataLayer = [];
    win.eval(ANALYTICS_SRC);
    await flush();
    return win;
  }

  it("fires booking_success + generate_lead from the params stashed before the checkout redirect", async () => {
    const win = await confirmedPage({ widget_id: "wpub", service_name: "Cut", value: 45, currency: "CAD" });
    expect(win.dataLayer.map((m: Record<string, unknown>) => m.event)).toEqual(["booking_success", "generate_lead"]);
    expect(win.dataLayer[0]).toMatchObject({ value: 45, currency: "CAD", booking_id: "req1", service_name: "Cut" });
    expect(win.sessionStorage.getItem("vms_booking_pending_req1")).toBeNull();
  });

  it("never fires twice for the same booking (reload)", async () => {
    const win = await confirmedPage({ widget_id: "wpub" }, true);
    expect(win.dataLayer).toEqual([]);
  });
});

// ─── booking.js ──────────────────────────────────────────────────────────

const CONFIG = {
  ok: true,
  services: [
    { id: "s1", name: "Coupe", analytics_name: "Haircut", duration_minutes: 30, price_cents: 4500, deposit_cents: 1000 },
    { id: "s2", name: "Couleur", analytics_name: "Color", duration_minutes: 60 },
  ],
  timezone: "America/Edmonton",
  custom_fields: [{ name: "phone", label: "Phone", type: "tel", required: false }],
  item_selector_style: "radio",
  max_services: 1,
  currency: "cad",
  name_fields: "full",
};
const SLOT_ISO = "2030-01-15T17:30:00.000Z"; // 10:30 in America/Edmonton

type Responder = (url: string, body: any) => { status: number; json: any };

function bookingPage(opts: { request?: Responder; confirm?: Responder; analytics?: boolean } = {}) {
  const { win, gtagCalls } = makeWindow({
    gtm: true,
    analytics: opts.analytics,
    html: `<section class="vms-booking-widget" data-cellpy-booking-widget="wpub"><div class="vms-booking-widget__mount" data-vms-booking-mount></div></section>`,
  });
  const ioCallbacks: Array<(entries: unknown[]) => void> = [];
  win.IntersectionObserver = class {
    constructor(cb: (entries: unknown[]) => void) {
      ioCallbacks.push(cb);
    }
    observe() {}
    disconnect() {}
  };
  win.fetch = vi.fn(async (url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    let res: { status: number; json: any };
    if (url.startsWith("/api/booking/widget-config")) res = { status: 200, json: CONFIG };
    else if (url.startsWith("/api/booking/availability")) res = { status: 200, json: { ok: true, slots: [{ startIso: SLOT_ISO }] } };
    else if (url === "/api/booking/request") res = (opts.request ?? (() => ({ status: 200, json: { ok: true, request_id: "req1" } })))(url, body);
    else if (url === "/api/booking/confirm") res = (opts.confirm ?? (() => ({ status: 200, json: { ok: true, requires_payment: false } })))(url, body);
    else res = { status: 404, json: { ok: false } };
    return { status: res.status, json: async () => res.json };
  });
  win.eval(BOOKING_SRC);
  const visible = () => ioCallbacks.forEach((cb) => cb([{ isIntersecting: true }]));
  return { win, gtagCalls, visible };
}

async function pickSlotAndFillForm(win: Win) {
  await flush();
  (win.document.querySelector(".vms-booking-widget__slot") as HTMLButtonElement).click();
  const form = win.document.querySelector(".vms-booking-widget__form") as HTMLFormElement;
  const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
  nameInput.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true }));
  nameInput.value = "Jane Doe";
  nameInput.dispatchEvent(new win.Event("input", { bubbles: true }));
  (form.querySelector('input[type="email"]') as HTMLInputElement).value = "jane@example.com";
  (form.querySelector('input[name="phone"]') as HTMLInputElement | null)?.setAttribute("value", "555-0100");
  return form;
}

async function submitRequest(win: Win, form: HTMLFormElement) {
  form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
}

async function submitCode(win: Win) {
  const codeForm = win.document.querySelector(".vms-booking-widget__code-form") as HTMLFormElement;
  (codeForm.querySelector("input") as HTMLInputElement).value = "123456";
  codeForm.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
}

describe("booking.js — funnel events", () => {
  it("emits the full funnel in order and booking_success only after the confirm API succeeds", async () => {
    const { win, gtagCalls, visible } = bookingPage();
    await flush();
    visible();
    visible(); // booking_view must still fire only once
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);

    let evs = events(win, gtagCalls);
    expect(names(evs)).toEqual([
      "booking_view",
      "booking_service_select",
      "booking_date_select",
      "booking_slot_select",
      "booking_form_start",
      "booking_submit",
      "booking_request_sent",
    ]);
    expect(names(evs)).not.toContain("booking_success");

    await submitCode(win);
    evs = events(win, gtagCalls);
    expect(names(evs).slice(-2)).toEqual(["booking_success", "generate_lead"]);

    const byName = Object.fromEntries(evs.map((e) => [e.name, e.params]));
    // preselected service/day kept by the visitor → marked as defaults
    expect(byName.booking_service_select).toMatchObject({ service_name: "Haircut", service_count: 1, selection_method: "default" });
    expect(byName.booking_date_select).toMatchObject({ selection_method: "default" });
    expect(byName.booking_slot_select).toMatchObject({ slot_date: "2030-01-15", slot_time: "10:30" });
    expect(byName.booking_success).toEqual({
      widget_id: "wpub",
      widget_placement: "inline",
      service_name: "Haircut",
      service_count: 1,
      value: 45,
      currency: "CAD",
      booking_id: "req1",
    });
    expect(byName.generate_lead).toMatchObject({ value: 45, currency: "CAD" });
    // every event identifies the widget
    evs.forEach((e) => expect(e.params.widget_id).toBe("wpub"));
  });

  it("never includes the visitor's name, email or custom field values in any event", async () => {
    const { win, gtagCalls, visible } = bookingPage();
    await flush();
    visible();
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    await submitCode(win);
    const serialized = JSON.stringify(win.dataLayer);
    expect(serialized).not.toContain("Jane");
    expect(serialized).not.toContain("jane@example.com");
    expect(serialized).not.toContain("555-0100");
    expect(serialized).not.toContain("123456");
    expect(events(win, gtagCalls).length).toBeGreaterThan(5);
  });

  it("an explicit service choice is a visitor booking_service_select, not repeated as a default later", async () => {
    const { win, gtagCalls } = bookingPage();
    await flush();
    (win.document.querySelectorAll('.vms-booking-widget__service-option input')[1] as HTMLInputElement).dispatchEvent(new win.Event("change"));
    await flush();
    (win.document.querySelector(".vms-booking-widget__slot") as HTMLButtonElement).click();
    const serviceEvents = events(win, gtagCalls).filter((e) => e.name === "booking_service_select");
    expect(serviceEvents).toHaveLength(1);
    expect(serviceEvents[0].params).toMatchObject({ service_name: "Color", selection_method: "visitor" });
  });

  it("the strip view's automatic first-day click is not a booking_date_select", async () => {
    const { win, gtagCalls } = bookingPage();
    await flush();
    expect(names(events(win, gtagCalls))).not.toContain("booking_date_select");
    (win.document.querySelectorAll(".vms-booking-widget__calendar-day")[2] as HTMLButtonElement).click();
    const dateEvents = events(win, gtagCalls).filter((e) => e.name === "booking_date_select");
    expect(dateEvents).toHaveLength(1);
    expect(dateEvents[0].params.selection_method).toBe("visitor");
  });

  it("emits booking_error (slot_taken) and no request_sent/success when the request API fails", async () => {
    const { win, gtagCalls } = bookingPage({
      request: () => ({ status: 400, json: { ok: false, reason: "NOT_AVAILABLE", message: "Taken" } }),
    });
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    const evs = events(win, gtagCalls);
    expect(names(evs)).toContain("booking_submit");
    expect(names(evs)).not.toContain("booking_request_sent");
    expect(names(evs)).not.toContain("booking_success");
    expect(evs.find((e) => e.name === "booking_error")!.params).toMatchObject({ error_type: "slot_taken", step: "request" });
  });

  it("emits booking_error (validation) and no success when the confirm code is wrong", async () => {
    const { win, gtagCalls } = bookingPage({
      confirm: () => ({ status: 400, json: { ok: false, reason: "WRONG_CODE", message: "Wrong code" } }),
    });
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    await submitCode(win);
    const evs = events(win, gtagCalls);
    expect(names(evs)).not.toContain("booking_success");
    expect(names(evs)).not.toContain("generate_lead");
    expect(evs.find((e) => e.name === "booking_error")!.params).toMatchObject({ error_type: "validation", step: "confirm" });
  });

  it("classifies 5xx and network failures as server errors", async () => {
    const { win, gtagCalls } = bookingPage({
      request: () => ({ status: 503, json: { ok: false, message: "Calendar down" } }),
    });
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    expect(events(win, gtagCalls).find((e) => e.name === "booking_error")!.params).toMatchObject({ error_type: "server" });

    const net = bookingPage({
      confirm: () => {
        throw new Error("offline");
      },
    });
    const form2 = await pickSlotAndFillForm(net.win);
    await submitRequest(net.win, form2);
    await submitCode(net.win);
    const err = events(net.win, net.gtagCalls).find((e) => e.name === "booking_error");
    expect(err!.params).toMatchObject({ error_type: "server", step: "confirm" });
  });

  it("a deposit booking fires booking_payment_start (not success) and stashes params for /booking-confirmed", async () => {
    const { win, gtagCalls } = bookingPage({
      confirm: () => ({ status: 200, json: { ok: true, requires_payment: true, checkout_url: "about:blank" } }),
    });
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    await submitCode(win);
    const evs = events(win, gtagCalls);
    expect(names(evs)).toContain("booking_payment_start");
    expect(names(evs)).not.toContain("booking_success");
    const stash = JSON.parse(win.sessionStorage.getItem("vms_booking_pending_req1")!);
    expect(stash).toMatchObject({ widget_id: "wpub", value: 45, currency: "CAD", service_name: "Haircut" });
  });

  it("does nothing (and the booking still works) when analytics isn't on the page", async () => {
    const { win } = bookingPage({ analytics: false });
    const form = await pickSlotAndFillForm(win);
    await submitRequest(win, form);
    await submitCode(win);
    expect(win.vmsBookingAnalytics).toBeUndefined();
    expect(win.dataLayer).toEqual([]);
    expect(win.document.querySelector(".vms-booking-widget__message")!.textContent).toMatch(/confirmed/i);
  });
});

describe("vms-analytics.js — phone_click + form_submit (template v59)", () => {
  const click = (win: Win, selector: string) => {
    const el = win.document.querySelector(selector)!;
    el.addEventListener("click", (e: Event) => e.preventDefault());
    el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  };

  it("fires phone_click with the link's location for header, footer, floating and section tel: links — never the number", async () => {
    const { win, gtagCalls } = makeWindow({
      ga: true,
      url: "https://example.com/services",
      html: `<div class="nav-top"><div class="nav-extras"><a id="h" href="tel:(403) 399-7376">(403) 399-7376</a></div></div>
        <div class="cellpy-block-site-footer"><a id="f" href="tel:4033997376">call</a></div>
        <div class="fw-slot"><a id="w" href="tel:4033997376">icon</a></div>
        <section><a id="s" href="TEL:+14033997376">call</a></section>`,
    });
    await flush();
    for (const id of ["h", "f", "w", "s"]) click(win, `#${id}`);
    const evs = events(win, gtagCalls);
    expect(names(evs)).toEqual(["phone_click", "phone_click", "phone_click", "phone_click"]);
    expect(evs.map((e) => e.params.link_location)).toEqual(["header", "footer", "floating", "section"]);
    expect(evs[0].params).toEqual({ link_location: "header", page_path: "/services" });
  });

  it("does not fire phone_click for ordinary links", async () => {
    const { win, gtagCalls } = makeWindow({ gtm: true, html: `<a id="m" href="mailto:x@y.com">mail</a><a id="a" href="https://other.com/">x</a>` });
    await flush();
    click(win, "#m");
    click(win, "#a");
    expect(names(events(win, gtagCalls))).not.toContain("phone_click");
  });

  it("formSubmit() fires form_submit followed by generate_lead with form_id and page_path", () => {
    const { win, gtagCalls } = makeWindow({ gtm: true, url: "https://example.com/quote" });
    win.vmsAnalytics.formSubmit("quote-form");
    const evs = events(win, gtagCalls);
    expect(names(evs)).toEqual(["form_submit", "generate_lead"]);
    expect(evs[1].params).toEqual({ form_id: "quote-form", page_path: "/quote" });
  });
});
