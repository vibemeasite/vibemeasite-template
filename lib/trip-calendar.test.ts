import { describe, it, expect } from "vitest";
import { buildMonthWeeks, shiftMonth, parseMonthParam, weekStartFor } from "./trip-calendar";
import { tripStatus, resolveText, travelTextToHtml, safeImageUrl, safeLinkUrl, ymd } from "./travel-text";

describe("month grid", () => {
  it("covers whole weeks around November 2026 (Monday start)", () => {
    const weeks = buildMonthWeeks("2026-11", 1, []);
    expect(weeks[0].days[0].date).toBe("2026-10-26"); // Nov 1 2026 is a Sunday
    expect(weeks[0].days[6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks[weeks.length - 1].days[6].date).toBe("2026-12-06");
    expect(weeks.length).toBe(6);
  });

  it("starts weeks on Sunday when asked", () => {
    const weeks = buildMonthWeeks("2026-11", 7, []);
    expect(weeks[0].days[0].date).toBe("2026-11-01");
    expect(weeks.length).toBe(5);
  });

  it("splits a multi-day trip into one bar per week row", () => {
    const weeks = buildMonthWeeks("2026-11", 1, [{ start: "2026-11-07", end: "2026-11-10" }]);
    const bars = weeks.flatMap((w, wi) => w.bars.map((b) => ({ wi, ...b })));
    expect(bars).toEqual([
      { wi: 1, index: 0, col: 6, span: 2, continuesBefore: false, continuesAfter: true },
      { wi: 2, index: 0, col: 1, span: 2, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("shows a trip spilling in from the previous month", () => {
    const weeks = buildMonthWeeks("2026-12", 1, [{ start: "2026-11-29", end: "2026-12-02" }]);
    expect(weeks[0].bars[0]).toMatchObject({ col: 1, span: 3, continuesBefore: true });
  });

  it("shifts and parses month keys", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(parseMonthParam("2026-11")).toBe("2026-11");
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam(["2026-11"])).toBeNull();
  });

  it("knows week starts", () => {
    expect([1, 7]).toContain(weekStartFor("uk"));
    expect(weekStartFor("fr")).toBe(1);
  });
});

describe("travel text", () => {
  it("derives status", () => {
    const t = { startAt: "2026-11-14T12:00:00Z", endAt: "2026-11-15T23:00:00Z" };
    expect(tripStatus(t, Date.parse("2026-11-01T00:00:00Z"))).toBe("upcoming");
    expect(tripStatus(t, Date.parse("2026-11-15T00:00:00Z"))).toBe("in_progress");
    expect(tripStatus(t, Date.parse("2027-01-01T00:00:00Z"))).toBe("past");
    expect(tripStatus({ ...t, cancelledAt: "2026-10-01T00:00:00Z" })).toBe("cancelled");
  });

  it("resolves locale → default → any", () => {
    expect(resolveText({ uk: "a", en: "b" }, "en", "uk")).toBe("b");
    expect(resolveText({ uk: "a" }, "fr", "uk")).toBe("a");
    expect(resolveText({ de: "x" }, "fr", "uk")).toBe("x");
    expect(resolveText({}, "fr", "uk")).toBeUndefined();
  });

  it("sanitizes owner text to a small safe subset", () => {
    expect(travelTextToHtml("Hello <strong>world</strong>\n\nSecond")).toBe("<p>Hello <strong>world</strong></p><p>Second</p>");
    expect(travelTextToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(travelTextToHtml('<a href="javascript:alert(1)">x</a>')).toBe("<p>x</p>");
    expect(travelTextToHtml('<a href="https://ex.com/?a=1&b=2">x</a>')).toBe('<p><a href="https://ex.com/?a=1&amp;b=2" rel="noopener" target="_blank">x</a></p>');
    expect(travelTextToHtml("<b>open")).toBe("<p><strong>open</strong></p>");
    expect(travelTextToHtml("line1\nline2")).toBe("<p>line1<br>line2</p>");
    expect(travelTextToHtml('<img src=x onerror="alert(1)">')).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
    expect(travelTextToHtml(null)).toBe("");
  });

  it("only allows safe URLs", () => {
    expect(safeImageUrl("https://cdn.cellpy.com/x.jpg")).toBe("https://cdn.cellpy.com/x.jpg");
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("//evil.com/x.jpg")).toBeNull();
    expect(safeLinkUrl("/book")).toBe("/book");
    expect(safeLinkUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeLinkUrl("http://x.com")).toBeNull();
  });

  it("formats dates in the trip's zone", () => {
    expect(ymd("2026-11-15T03:00:00Z", "America/Toronto")).toBe("2026-11-14");
  });
});
