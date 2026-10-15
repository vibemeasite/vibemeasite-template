import { layoutRouteMap, type MapDecor } from "../lib/trip-map";

// BSA Phase 27 (US-VMAS-TRAVEL-06) — the illustrated ("storybook") trip map: an
// island with a wobbly coastline in a little sea, scattered trees, hills and
// mountains, a compass rose, and the route as a winding dashed trail between
// teardrop pins. Inline SVG drawn from lib/trip-map.ts — no map tiles, so it
// works offline and costs a few KB.
//
// Each pin is an SVG <a href="#stop-N">: focusable, keyboard-operable, and
// with JS off it just scrolls to that stop's article below; public/trip.js
// upgrades the click to the stop panel. The scenery has its own friendly
// palette; the trail and pins follow the site's branding (--vms-trip-accent).

interface Props {
  stops: Array<{ position: number; lat: number; lng: number; mapX: number | null; mapY: number | null; title: string }>;
  ariaLabel: string;
}

function Decor({ d }: { d: MapDecor }) {
  const t = `translate(${d.x} ${d.y}) scale(${d.s})`;
  switch (d.kind) {
    case "tree":
      return (
        <g transform={t} className="vms-map__tree">
          <rect x="-3" y="2" width="6" height="14" rx="2" className="vms-map__trunk" />
          <circle cx="0" cy="-6" r="14" className="vms-map__leaf" />
          <circle cx="-5" cy="-10" r="5" className="vms-map__leaf-hi" />
        </g>
      );
    case "pine":
      return (
        <g transform={t}>
          <rect x="-2.5" y="8" width="5" height="9" className="vms-map__trunk" />
          <path d="M0 -24 L13 -2 L6 -2 L16 11 L-16 11 L-6 -2 L-13 -2 Z" className="vms-map__pine" />
        </g>
      );
    case "hill":
      return (
        <g transform={t}>
          <path d="M-34 12 Q-14 -18 6 12 Z" className="vms-map__hill" />
          <path d="M-8 12 Q12 -10 30 12 Z" className="vms-map__hill vms-map__hill--back" />
        </g>
      );
    case "mountain":
      return (
        <g transform={t}>
          <path d="M-30 16 L-4 -26 L22 16 Z" className="vms-map__mtn" />
          <path d="M-4 -26 L5 -11 L0 -14 L-5 -9 L-11 -15 Z" className="vms-map__snow" />
          <path d="M6 16 L22 -8 L36 16 Z" className="vms-map__mtn vms-map__mtn--back" />
        </g>
      );
    case "wave":
      return <path transform={t} d="M-16 0 q8 -8 16 0 t16 0" className="vms-map__wave" />;
  }
}

// Teardrop pin with its point at (x, y).
function pinPath(x: number, y: number, r: number): string {
  return `M${x} ${y} C${x - r * 0.35} ${y - r * 0.9} ${x - r} ${y - r * 1.25} ${x - r} ${y - r * 1.9} A${r} ${r} 0 1 1 ${x + r} ${y - r * 1.9} C${x + r} ${y - r * 1.25} ${x + r * 0.35} ${y - r * 0.9} ${x} ${y} Z`;
}

export function TripRouteMap({ stops, ariaLabel }: Props) {
  if (!stops.length) return null;
  const layout = layoutRouteMap(stops.map((s) => ({ lat: s.lat, lng: s.lng, mapX: s.mapX, mapY: s.mapY, label: s.title })));
  const { width: W, height: H } = layout;

  return (
    <figure className="vms-route">
      <svg className="vms-route__svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="vms-map-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* Sea */}
        <rect x="0" y="0" width={W} height={H} rx="30" className="vms-map__sea" />
        <rect x="10" y="10" width={W - 20} height={H - 20} rx="24" className="vms-map__frame" />

        {/* Land: soft shoreline, then the island */}
        <path d={layout.land} className="vms-map__shore" transform={`translate(${W / 2} ${H / 2}) scale(1.035) translate(${-W / 2} ${-H / 2})`} />
        <path d={layout.land} className="vms-map__land" />
        <path d={layout.land} className="vms-map__land-edge" />

        {/* Scenery */}
        {layout.decor.map((d, i) => <Decor key={i} d={d} />)}

        {/* Compass rose */}
        <g transform={`translate(${layout.compass.x} ${layout.compass.y})`} className="vms-map__compass" aria-hidden="true">
          <circle r="30" className="vms-map__compass-ring" />
          <path d="M0 -26 L7 0 L0 26 L-7 0 Z" className="vms-map__compass-ns" />
          <path d="M0 -26 L7 0 L-7 0 Z" className="vms-map__compass-n" />
          <path d="M-26 0 L0 6 L26 0 L0 -6 Z" className="vms-map__compass-ew" />
          <text y="-34" textAnchor="middle" className="vms-map__compass-label">N</text>
        </g>

        {/* Trail */}
        {layout.legs.filter(Boolean).map((d, i) => (
          <g key={i}>
            <path d={d} className="vms-route__line-halo" />
            <path d={d} className="vms-route__line" />
          </g>
        ))}

        {/* Pins and their paper tags */}
        {layout.points.map((p, i) => {
          if (layout.sameAs[i] !== null) return null;
          const stop = stops[i];
          const label = layout.labels[i];
          const group = stops.filter((_, j) => j === i || layout.sameAs[j] === i);
          const nums = group.map((g) => g.position).join("·");
          return (
            <a
              key={stop.position}
              href={`#stop-${stop.position}`}
              className="vms-route__stop"
              data-stop={stop.position}
              aria-label={group.map((g) => `${g.position}. ${g.title}`).join("; ")}
            >
              <circle className="vms-route__hit" cx={p.x} cy={p.y - 24} r="40" />
              <ellipse cx={p.x} cy={p.y + 2} rx="12" ry="4" className="vms-route__pin-shadow" />
              <path d={pinPath(p.x, p.y, 22)} className="vms-route__marker" filter="url(#vms-map-shadow)" />
              <text className="vms-route__num" x={p.x} y={p.y - 34} textAnchor="middle" style={nums.length > 2 ? { fontSize: 15 } : undefined}>
                {nums}
              </text>
              {label && (
                <g className="vms-route__tag">
                  <rect x={label.box.x} y={label.box.y} width={label.box.w} height={label.box.h} rx="10" className="vms-route__tag-bg" filter="url(#vms-map-shadow)" />
                  <text className="vms-route__label" x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>
                </g>
              )}
            </a>
          );
        })}
      </svg>
    </figure>
  );
}
