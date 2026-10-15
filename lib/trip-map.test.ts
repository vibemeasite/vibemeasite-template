import { describe, it, expect } from "vitest";
import { layoutRouteMap, truncateLabel, MAP_WIDTH } from "./trip-map";

describe("layoutRouteMap", () => {
  it("handles no stops", () => {
    const l = layoutRouteMap([]);
    expect(l.points).toEqual([]);
    expect(l.width).toBe(MAP_WIDTH);
  });

  it("centres a single stop", () => {
    const l = layoutRouteMap([{ lat: 45.5, lng: -73.6, label: "Montréal" }]);
    expect(l.points[0]).toEqual({ x: l.width / 2, y: l.height / 2 });
    expect(l.labels[0]?.text).toBe("Montréal");
  });

  it("keeps points inside the padded area and preserves east/west, north/south order", () => {
    const l = layoutRouteMap([
      { lat: 45.5, lng: -73.6, label: "Montréal" },
      { lat: 46.8, lng: -71.2, label: "Québec" },
      { lat: 48.1, lng: -69.7, label: "Tadoussac" },
    ]);
    for (const p of l.points) {
      expect(p.x).toBeGreaterThanOrEqual(l.width * 0.08 - 0.1);
      expect(p.x).toBeLessThanOrEqual(l.width * 0.92 + 0.1);
      expect(p.y).toBeGreaterThanOrEqual(l.height * 0.08 - 0.1);
      expect(p.y).toBeLessThanOrEqual(l.height * 0.92 + 0.1);
    }
    expect(l.points[0].x).toBeLessThan(l.points[2].x); // Montréal is west of Tadoussac
    expect(l.points[0].y).toBeGreaterThan(l.points[2].y); // and south (larger SVG y)
  });

  it("clamps the aspect ratio both ways", () => {
    const wide = layoutRouteMap([{ lat: 45, lng: -80, label: "A" }, { lat: 45, lng: -60, label: "B" }]);
    expect(wide.height / wide.width).toBeCloseTo(9 / 16, 2);
    const tall = layoutRouteMap([{ lat: 40, lng: -73, label: "A" }, { lat: 50, lng: -73, label: "B" }]);
    expect(tall.height / tall.width).toBeCloseTo(4 / 3, 2);
  });

  it("lets a manual position override the projection", () => {
    const l = layoutRouteMap([
      { lat: 45.5, lng: -73.6, label: "A" },
      { lat: 46.8, lng: -71.2, label: "B", mapX: 0, mapY: 1 },
    ]);
    expect(l.points[1].x).toBeCloseTo(l.width * 0.08, 0);
    expect(l.points[1].y).toBeCloseTo(l.height * 0.92, 0);
  });

  it("places labels so they don't overlap, dropping ones with no room", () => {
    // Six stops at the same point: four label slots around one marker, then none left.
    const crowd = Array.from({ length: 6 }, (_, i) => ({ lat: 45.5, lng: -73.6, label: `Stop ${i + 1}` }));
    const l = layoutRouteMap(crowd);
    const placed = l.labels.filter(Boolean);
    expect(placed.length).toBe(4);
    expect(new Set(placed.map((p) => p!.anchor + p!.y)).size).toBe(4);
    expect(l.labels.some((x) => x === null)).toBe(true);
  });
});

describe("truncateLabel", () => {
  it("truncates long names with an ellipsis", () => {
    expect(truncateLabel("Short")).toBe("Short");
    expect(truncateLabel("A very long place name that goes on and on")).toMatch(/…$/);
    expect(truncateLabel("A very long place name that goes on and on").length).toBe(28);
  });
});
