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
    // Six distinct stops packed a few units apart (manual positions).
    const crowd = Array.from({ length: 6 }, (_, i) => ({ lat: 45.5, lng: -73.6, mapX: 0.5 + i * 0.006, mapY: 0.5, label: `Stop ${i + 1}` }));
    const l = layoutRouteMap(crowd);
    expect(l.sameAs.every((x) => x === null)).toBe(true);
    const boxes = l.labels.flatMap((lab) => {
      if (!lab) return [];
      const w = lab.text.length * 26 * 0.56;
      const x1 = lab.anchor === "start" ? lab.x : lab.anchor === "end" ? lab.x - w : lab.x - w / 2;
      return [{ x1, x2: x1 + w, y1: lab.y - 26, y2: lab.y + 6 }];
    });
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

describe("truncateLabel", () => {
  it("truncates long names with an ellipsis", () => {
    expect(truncateLabel("Short")).toBe("Short");
    expect(truncateLabel("A very long place name that goes on and on")).toMatch(/…$/);
    expect(truncateLabel("A very long place name that goes on and on").length).toBe(28);
  });
});
