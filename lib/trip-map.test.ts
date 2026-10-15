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
      expect(p.x).toBeGreaterThanOrEqual(l.width * 0.15 - 0.1);
      expect(p.x).toBeLessThanOrEqual(l.width * 0.85 + 0.1);
      expect(p.y).toBeGreaterThanOrEqual(l.height * 0.15 - 0.1);
      expect(p.y).toBeLessThanOrEqual(l.height * 0.85 + 0.1);
    }
    expect(l.points[0].x).toBeLessThan(l.points[2].x); // Montréal is west of Tadoussac
    expect(l.points[0].y).toBeGreaterThan(l.points[2].y); // and south (larger SVG y)
  });

  it("clamps the aspect ratio both ways", () => {
    const wide = layoutRouteMap([{ lat: 45, lng: -80, label: "A" }, { lat: 45, lng: -60, label: "B" }]);
    expect(wide.height / wide.width).toBeCloseTo(0.58, 2);
    const tall = layoutRouteMap([{ lat: 40, lng: -73, label: "A" }, { lat: 50, lng: -73, label: "B" }]);
    expect(tall.height / tall.width).toBeCloseTo(0.9, 2);
  });

  it("lets a manual position override the projection", () => {
    const l = layoutRouteMap([
      { lat: 45.5, lng: -73.6, label: "A" },
      { lat: 46.8, lng: -71.2, label: "B", mapX: 0, mapY: 1 },
    ]);
    expect(l.points[1].x).toBeCloseTo(l.width * 0.15, 0);
    expect(l.points[1].y).toBeCloseTo(l.height * 0.85, 0);
  });

  it("places labels so they don't overlap, dropping ones with no room", () => {
    // Six distinct stops packed a few units apart (manual positions).
    const crowd = Array.from({ length: 6 }, (_, i) => ({ lat: 45.5 + i * 0.001, lng: -73.6, mapX: 0.5 + i * 0.006, mapY: 0.5, label: `Stop ${i + 1}` }));
    const l = layoutRouteMap(crowd);
    expect(l.sameAs.every((x) => x === null)).toBe(true);
    const boxes = l.labels.flatMap((lab) => (lab ? [{ x1: lab.box.x, x2: lab.box.x + lab.box.w, y1: lab.box.y, y2: lab.box.y + lab.box.h }] : []));
    expect(boxes.length).toBeGreaterThan(0);
    expect(l.labels.some((x) => x === null)).toBe(true);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1).toBe(false);
      }
  });
});

describe("shared spots", () => {
  it("merges a round trip's start and end into one marker", () => {
    const l = layoutRouteMap([
      { lat: 45.5, lng: -73.6, label: "Montréal" },
      { lat: 46.8, lng: -71.2, label: "Québec" },
      { lat: 45.5, lng: -73.6, label: "Montréal" },
    ]);
    expect(l.sameAs).toEqual([null, null, 0]);
    expect(l.labels[2]).toBeNull();
    expect(l.labels[0]?.text).toBe("Montréal");
  });
});

describe("storybook scenery", () => {
  const route = [
    { lat: 45.5152, lng: -73.561, label: "Montréal" },
    { lat: 46.8906, lng: -71.1478, label: "Montmorency" },
    { lat: 46.8123, lng: -71.2045, label: "Old Québec" },
    { lat: 45.5152, lng: -73.561, label: "Montréal" },
  ];
  it("is deterministic for the same route", () => {
    expect(layoutRouteMap(route)).toEqual(layoutRouteMap(route));
  });
  it("draws curved legs, a coastline, scenery and a compass clear of the pins", () => {
    const l = layoutRouteMap(route);
    expect(l.legs).toHaveLength(3);
    for (const d of l.legs) expect(d).toMatch(/^M[\d.]+ [\d.]+ Q/);
    expect(l.land).toMatch(/^M.* Z$/);
    expect(l.decor.length).toBeGreaterThan(5);
    for (const d of l.decor) {
      for (const p of l.points) expect(Math.hypot(d.x - p.x, d.y - p.y + 22)).toBeGreaterThan(50);
    }
    const nearest = Math.min(...l.points.map((p) => Math.hypot(p.x - l.compass.x, p.y - l.compass.y)));
    expect(nearest).toBeGreaterThan(80);
  });
  it("pulls close stops apart (not to scale)", () => {
    const l = layoutRouteMap(route);
    // Montmorency and Old Québec are ~6 km apart but must not overlap.
    expect(Math.hypot(l.points[1].x - l.points[2].x, l.points[1].y - l.points[2].y)).toBeGreaterThan(80);
  });
  it("bends an out-and-back leg to the other side", () => {
    const l = layoutRouteMap([
      { lat: 45.5, lng: -73.6, label: "A" },
      { lat: 46.8, lng: -71.2, label: "B" },
      { lat: 45.5, lng: -73.6, label: "A" },
    ]);
    const ctrl = (d: string) => d.split(" Q")[1].split(" ").slice(0, 2).map(Number);
    const [c1, c2] = [ctrl(l.legs[0]), ctrl(l.legs[1])];
    expect(Math.hypot(c1[0] - c2[0], c1[1] - c2[1])).toBeGreaterThan(40);
  });
});

describe("truncateLabel", () => {
  it("truncates long names with an ellipsis", () => {
    expect(truncateLabel("Short")).toBe("Short");
    expect(truncateLabel("A very long place name that goes on and on")).toMatch(/…$/);
    expect(truncateLabel("A very long place name that goes on and on").length).toBe(26);
  });
});
