// BSA Phase 27 (US-VMAS-TRAVEL-06) — route map layout for the illustrated
// ("storybook") trip map. Pure: stops' coordinates in, everything the SVG needs
// out — stop positions, curved trail legs, label tags, an island coastline and
// scattered scenery. components/TripRouteMap.tsx only draws it. A drawn map
// (not map tiles) is what makes it work offline and keeps it a few KB (BSA P5).
//
// It is deliberately NOT to scale: like a cartoon map, close stops are pulled
// apart and far ones pulled in (rank-blended positions), so a route like
// Montréal → Montmorency → Old Québec (15 km apart at the end of a 250 km
// drive) still reads as three distinct places. Every random choice is seeded
// from the stops themselves, so a trip always renders the same map.

export interface MapStopInput {
  lat: number;
  lng: number;
  mapX?: number | null; // manual override, 0..1 inside the padded area
  mapY?: number | null;
  label: string;
}

export interface MapLabel {
  x: number; // text anchor point
  y: number; // text baseline
  anchor: "start" | "end" | "middle";
  text: string;
  box: { x: number; y: number; w: number; h: number }; // the paper tag behind it
}

export type DecorKind = "tree" | "pine" | "hill" | "mountain" | "wave";

export interface MapDecor {
  kind: DecorKind;
  x: number;
  y: number;
  s: number; // scale, ~0.8–1.3
}

export interface RouteMapLayout {
  width: number;
  height: number;
  points: Array<{ x: number; y: number }>;
  labels: Array<MapLabel | null>; // null = label dropped (pin number only)
  // Index of an earlier stop at the same place (a round trip's start and end,
  // or a revisit), else null. Such stops share that stop's pin and label.
  sameAs: Array<number | null>;
  legs: string[]; // one SVG path "d" per leg, stop i → i+1 (curved)
  land: string; // island coastline path "d"
  decor: MapDecor[];
  compass: { x: number; y: number }; // centre, in the emptiest corner
}

export const MAP_WIDTH = 1000;
const PAD = 0.15; // room for the coastline, sea and edge labels
const MIN_ASPECT = 0.58; // height / width
const MAX_ASPECT = 0.9;
const RANK_BLEND = 0.55; // 0 = true geography, 1 = evenly spaced
const PIN_R = 22;
const FONT = 25;
const CHAR_W = FONT * 0.56;
const LABEL_MAX_CHARS = 26;
const TAG_PAD_X = 12;
const TAG_H = FONT + 14;

interface Box { x1: number; y1: number; x2: number; y2: number }

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export function truncateLabel(text: string, max = LABEL_MAX_CHARS): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Small deterministic PRNG (mulberry32) seeded from the route itself.
function seededRandom(stops: MapStopInput[]): () => number {
  let h = 2166136261;
  for (const s of stops) {
    for (const v of [s.lat, s.lng]) {
      h ^= Math.round(v * 1e4);
      h = Math.imul(h, 16777619);
    }
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Evenly spaced 0..1 position by rank among the distinct values (ties share).
function rankPositions(values: number[]): number[] {
  const distinct = [...new Set(values.map((v) => Math.round(v * 1e6)))].sort((a, b) => a - b);
  if (distinct.length < 2) return values.map(() => 0.5);
  return values.map((v) => distinct.indexOf(Math.round(v * 1e6)) / (distinct.length - 1));
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values), max = Math.max(...values);
  return values.map((v) => (max > min ? (v - min) / (max - min) : 0.5));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function layoutRouteMap(stops: MapStopInput[]): RouteMapLayout {
  const empty = { width: MAP_WIDTH, height: Math.round(MAP_WIDTH * MIN_ASPECT), points: [], labels: [], sameAs: [], legs: [], land: "", decor: [], compass: { x: MAP_WIDTH - 64, y: 64 } };
  if (stops.length === 0) return empty;
  const rand = seededRandom(stops);

  // Same place = same coordinates (a round trip's start and end).
  const sameAs = stops.map((p, i) => {
    const j = stops.findIndex((q, k) => k < i && Math.abs(q.lat - p.lat) < 1e-5 && Math.abs(q.lng - p.lng) < 1e-5);
    return j === -1 ? null : j;
  });

  // Equirectangular projection (x scaled by cos(mean latitude)), then blended
  // with rank order so the stops spread over the whole map.
  const meanLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const kx = Math.cos((meanLat * Math.PI) / 180) || 1;
  const gx = stops.map((p) => p.lng * kx);
  const gy = stops.map((p) => -p.lat);
  const spanX = Math.max(...gx) - Math.min(...gx), spanY = Math.max(...gy) - Math.min(...gy);
  const blend = (geo: number[]) => {
    const lin = normalize(geo), rank = rankPositions(geo);
    return lin.map((v, i) => (1 - RANK_BLEND) * v + RANK_BLEND * rank[i]);
  };
  let ux = blend(gx), uy = blend(gy);
  // A route that is nearly straight north–south or east–west would collapse to
  // a line: give the flat axis a gentle zig-zag so it still looks like a trail.
  if (spanY < spanX * 0.15) uy = uy.map((_, i) => 0.5 + (i % 2 === 0 ? -0.18 : 0.18) * (stops.length > 1 ? 1 : 0));
  if (spanX < spanY * 0.15) ux = ux.map((_, i) => 0.5 + (i % 2 === 0 ? -0.18 : 0.18) * (stops.length > 1 ? 1 : 0));

  const aspect = Math.min(Math.max(spanX > 0 ? spanY / spanX : MAX_ASPECT, MIN_ASPECT), MAX_ASPECT);
  const width = MAP_WIDTH;
  const height = Math.round(width * aspect);
  const offX = width * PAD, offY = height * PAD;
  const innerW = width - 2 * offX, innerH = height - 2 * offY;

  const points = stops.map((p, i) => {
    const mx = typeof p.mapX === "number" && typeof p.mapY === "number" ? p.mapX : null;
    const my = mx !== null ? (p.mapY as number) : null;
    if (sameAs[i] !== null && mx === null) return null; // filled in below from its twin
    return { x: r1(offX + (mx ?? ux[i]) * innerW), y: r1(offY + (my ?? uy[i]) * innerH) };
  });
  const pts = points.map((p, i) => p ?? points[sameAs[i]!]!) as Array<{ x: number; y: number }>;

  // Curved legs: a quadratic bend to alternating sides. A leg that retraces an
  // earlier one in reverse (out-and-back) bends the other way, so the two trails
  // never lie on top of each other.
  const legs: string[] = [];
  const bends: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      bends.push(0);
      legs.push("");
      continue;
    }
    let side = i % 2 === 0 ? 1 : -1;
    const reverse = pts.findIndex((p, k) => k < i && Math.abs(p.x - b.x) < 1 && Math.abs(p.y - b.y) < 1 && Math.abs(pts[k + 1].x - a.x) < 1 && Math.abs(pts[k + 1].y - a.y) < 1);
    if (reverse !== -1) side = bends[reverse] >= 0 ? 1 : -1; // same physical side = opposite of the reversed direction
    const bend = side * Math.min(len * 0.22, 90);
    bends.push(bend);
    const cx = (a.x + b.x) / 2 - (dy / len) * bend;
    const cy = (a.y + b.y) / 2 + (dx / len) * bend;
    legs.push(`M${r1(a.x)} ${r1(a.y)} Q${r1(cx)} ${r1(cy)} ${r1(b.x)} ${r1(b.y)}`);
  }

  // Trail samples, used to keep labels and scenery off the route.
  const trail: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const cx = (a.x + b.x) / 2 - (dy / len) * bends[i], cy = (a.y + b.y) / 2 + (dx / len) * bends[i];
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      trail.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y });
    }
  }

  // Labels: paper tags right / left / above / below the pin, first spot that
  // stays on the map and clears every pin and earlier tag.
  // Pin = teardrop whose head (radius PIN_R) is centred PIN_R*1.9 above its point.
  const taken: Box[] = pts.map((p) => ({ x1: p.x - PIN_R, y1: p.y - PIN_R * 3, x2: p.x + PIN_R, y2: p.y + 6 }));
  const labels = stops.map((s, i): MapLabel | null => {
    if (sameAs[i] !== null) return null;
    const text = truncateLabel(s.label);
    if (!text) return null;
    const w = text.length * CHAR_W + 2 * TAG_PAD_X, h = TAG_H;
    const { x, y } = pts[i];
    const pinMid = y - PIN_R * 1.9;
    const gap = PIN_R + 10;
    const options: Array<{ bx: number; by: number; anchor: MapLabel["anchor"] }> = [
      { bx: x + gap, by: pinMid - h / 2, anchor: "start" },
      { bx: x - gap - w, by: pinMid - h / 2, anchor: "end" },
      { bx: x - w / 2, by: y - PIN_R * 3 - h - 6, anchor: "middle" },
      { bx: x - w / 2, by: y + 12, anchor: "middle" },
    ];
    for (const o of options) {
      const box = { x1: o.bx, y1: o.by, x2: o.bx + w, y2: o.by + h };
      if (box.x1 < 4 || box.x2 > width - 4 || box.y1 < 4 || box.y2 > height - 4) continue;
      if (taken.some((t, j) => j !== i && overlaps(box, t))) continue;
      taken.push(box);
      const tx = o.anchor === "start" ? o.bx + TAG_PAD_X : o.anchor === "end" ? o.bx + w - TAG_PAD_X : o.bx + w / 2;
      return { x: r1(tx), y: r1(o.by + h / 2 + FONT * 0.35), anchor: o.anchor, text, box: { x: r1(o.bx), y: r1(o.by), w: r1(w), h } };
    }
    return null;
  });

  // Island coastline: a wobbly superellipse (a rounded rectangle with soft
  // corners), so stops near the corners still sit on land.
  const N = 28;
  const cxL = width / 2, cyL = height / 2;
  const rx = width / 2 - width * 0.055, ry = height / 2 - height * 0.07;
  const ring = Array.from({ length: N }, (_, k) => {
    const ang = (k / N) * Math.PI * 2;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const e = 2 / 4.5; // superellipse exponent 4.5
    const wob = 0.95 + rand() * 0.07;
    return {
      x: cxL + Math.sign(c) * Math.abs(c) ** e * rx * wob,
      y: cyL + Math.sign(sn) * Math.abs(sn) ** e * ry * wob,
    };
  });
  const land = smoothClosedPath(ring);
  const onIsland = (x: number, y: number) => (Math.abs(x - cxL) / (rx * 0.92)) ** 4.5 + (Math.abs(y - cyL) / (ry * 0.9)) ** 4.5 <= 1;

  // Compass rose in whichever corner is farthest from every pin and tag.
  const corners = [
    { x: width - 66, y: 66 }, { x: 66, y: 66 }, { x: width - 66, y: height - 66 }, { x: 66, y: height - 66 },
  ];
  const clearance = (c: { x: number; y: number }) =>
    Math.min(
      ...pts.map((p) => Math.hypot(p.x - c.x, p.y - PIN_R - c.y)),
      ...taken.slice(pts.length).map((b) => Math.hypot(Math.max(b.x1 - c.x, 0, c.x - b.x2), Math.max(b.y1 - c.y, 0, c.y - b.y2))),
    );
  const compass = corners.reduce((best, c) => (clearance(c) > clearance(best) ? c : best), corners[0]);

  // Scenery: jittered grid, skipping anything near the trail, pins or tags.
  const decor: MapDecor[] = [];
  const cell = 74;
  for (let gy2 = cell / 2; gy2 < height; gy2 += cell) {
    for (let gx2 = cell / 2; gx2 < width; gx2 += cell) {
      const x = gx2 + (rand() - 0.5) * cell * 0.7;
      const y = gy2 + (rand() - 0.5) * cell * 0.7;
      const roll = rand();
      const onLand = onIsland(x, y);
      if (Math.hypot(x - compass.x, y - compass.y) < 60) continue;
      const nearTrail = trail.some((t) => Math.hypot(t.x - x, t.y - y) < 62);
      const nearPin = pts.some((p) => Math.hypot(p.x - x, p.y - y + PIN_R) < 70);
      const inTag = taken.some((b) => x > b.x1 - 34 && x < b.x2 + 34 && y > b.y1 - 34 && y < b.y2 + 34);
      if (nearTrail || nearPin || inTag) continue;
      if (!onLand) {
        // Waves only in open sea, clear of the (wobbly) shoreline.
        const outside = (Math.abs(x - cxL) / (rx * 1.06)) ** 4.5 + (Math.abs(y - cyL) / (ry * 1.08)) ** 4.5 > 1;
        if (outside && roll < 0.45 && x > 24 && x < width - 24 && y > 18 && y < height - 18) decor.push({ kind: "wave", x: r1(x), y: r1(y), s: r1(0.8 + rand() * 0.4) });
        continue;
      }
      if (roll < 0.16) continue; // leave some open meadow
      const kind: DecorKind = roll < 0.42 ? "tree" : roll < 0.66 ? "pine" : roll < 0.84 ? "hill" : "mountain";
      decor.push({ kind, x: r1(x), y: r1(y), s: r1(0.8 + rand() * 0.5) });
    }
  }
  // Draw back-to-front so lower items overlap the ones behind them.
  decor.sort((a, b) => a.y - b.y);

  return { width, height, points: pts, labels, sameAs, legs, land, decor, compass };
}

// Closed Catmull-Rom spline through the points, as cubic Béziers.
function smoothClosedPath(p: Array<{ x: number; y: number }>): string {
  const n = p.length;
  let d = `M${r1(p[0].x)} ${r1(p[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return `${d} Z`;
}
