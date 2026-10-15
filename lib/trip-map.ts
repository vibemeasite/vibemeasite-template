// BSA Phase 27 (US-VMAS-TRAVEL-06) — schematic route map layout. Pure: stops'
// coordinates in, SVG-space positions + label placements out. The SVG itself is
// drawn by components/TripRouteMap.tsx. A drawn schematic (not map tiles) is
// what makes the map work offline and keeps it a few KB (BSA P5).

export interface MapStopInput {
  lat: number;
  lng: number;
  mapX?: number | null; // manual override, 0..1 inside the padded area
  mapY?: number | null;
  label: string;
}

export interface MapLabel {
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  text: string;
}

export interface RouteMapLayout {
  width: number;
  height: number;
  points: Array<{ x: number; y: number }>;
  labels: Array<MapLabel | null>; // null = label dropped (number badge only)
  // Index of an earlier stop drawn at the same spot (a round trip's start and
  // end, or a revisit), else null. Such stops share that stop's marker and
  // label instead of drawing a second marker on top of it.
  sameAs: Array<number | null>;
}

export const MAP_WIDTH = 1000;
const PAD = 0.08;
const MIN_ASPECT = 9 / 16; // height / width
const MAX_ASPECT = 4 / 3;
const MARKER_R = 18;
const FONT = 26;
const CHAR_W = FONT * 0.56;
const LABEL_MAX_CHARS = 28;

interface Box { x1: number; y1: number; x2: number; y2: number }

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export function truncateLabel(text: string, max = LABEL_MAX_CHARS): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function layoutRouteMap(stops: MapStopInput[]): RouteMapLayout {
  if (stops.length === 0) return { width: MAP_WIDTH, height: Math.round(MAP_WIDTH * MIN_ASPECT), points: [], labels: [], sameAs: [] };

  // Equirectangular projection, x scaled by cos(mean latitude) so distances
  // look right at the route's latitude.
  const meanLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const kx = Math.cos((meanLat * Math.PI) / 180) || 1;
  const xs = stops.map((p) => p.lng * kx);
  const ys = stops.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX, spanY = maxY - minY;

  let aspect = spanX > 0 ? spanY / spanX : spanY > 0 ? MAX_ASPECT : MIN_ASPECT;
  aspect = Math.min(Math.max(aspect, MIN_ASPECT), MAX_ASPECT);
  const width = MAP_WIDTH;
  const height = Math.round(MAP_WIDTH * aspect);
  const innerW = width * (1 - 2 * PAD), innerH = height * (1 - 2 * PAD);
  const offX = width * PAD, offY = height * PAD;

  // Uniform scale (keeps the route's shape) fitted to the tighter dimension,
  // then centred along the other one.
  const scale = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const usedW = Number.isFinite(scale) ? spanX * scale : 0;
  const usedH = Number.isFinite(scale) ? spanY * scale : 0;
  const cx = offX + (innerW - usedW) / 2, cy = offY + (innerH - usedH) / 2;

  const points = stops.map((p, i) => {
    if (typeof p.mapX === "number" && typeof p.mapY === "number") {
      return { x: round(offX + p.mapX * innerW), y: round(offY + p.mapY * innerH) };
    }
    if (!Number.isFinite(scale)) return { x: round(width / 2), y: round(height / 2) };
    return { x: round(cx + (xs[i] - minX) * scale), y: round(cy + (ys[i] - minY) * scale) };
  });

  // Greedy label placement: right, left, above, below the marker; first spot
  // that stays inside the map and clears every marker and earlier label.
  const taken: Box[] = points.map((p) => ({ x1: p.x - MARKER_R, y1: p.y - MARKER_R, x2: p.x + MARKER_R, y2: p.y + MARKER_R }));
  const sameAs = points.map((p, i) => {
    const j = points.findIndex((q, k) => k < i && Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1);
    return j === -1 ? null : j;
  });
  const labels = stops.map((s, i): MapLabel | null => {
    if (sameAs[i] !== null) return null;
    const text = truncateLabel(s.label);
    if (!text) return null;
    const w = text.length * CHAR_W, h = FONT * 1.2;
    const { x, y } = points[i];
    const gap = MARKER_R + 8;
    const candidates: Array<{ box: Box; label: MapLabel }> = [
      { box: { x1: x + gap, y1: y - h / 2, x2: x + gap + w, y2: y + h / 2 }, label: { x: x + gap, y: y + FONT * 0.35, anchor: "start", text } },
      { box: { x1: x - gap - w, y1: y - h / 2, x2: x - gap, y2: y + h / 2 }, label: { x: x - gap, y: y + FONT * 0.35, anchor: "end", text } },
      { box: { x1: x - w / 2, y1: y - gap - h, x2: x + w / 2, y2: y - gap }, label: { x, y: y - gap - FONT * 0.25, anchor: "middle", text } },
      { box: { x1: x - w / 2, y1: y + gap, x2: x + w / 2, y2: y + gap + h }, label: { x, y: y + gap + FONT * 0.9, anchor: "middle", text } },
    ];
    for (const c of candidates) {
      const inside = c.box.x1 >= 0 && c.box.x2 <= width && c.box.y1 >= 0 && c.box.y2 <= height;
      if (!inside) continue;
      if (taken.some((t, j) => j !== i && overlaps(c.box, t))) continue;
      taken.push(c.box);
      return { ...c.label, x: round(c.label.x), y: round(c.label.y) };
    }
    return null;
  });

  return { width, height, points, labels, sameAs };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
