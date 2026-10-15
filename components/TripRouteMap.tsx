import { layoutRouteMap } from "../lib/trip-map";

// BSA Phase 27 (US-VMAS-TRAVEL-06) — the schematic route map, an inline SVG
// drawn from the stops' coordinates (lib/trip-map.ts). Each marker is an SVG
// <a href="#stop-N">: focusable, keyboard-operable, and with JS off it just
// scrolls to that stop's article below. public/trip.js upgrades the click to
// the stop panel. Colours follow the site's branding tokens.

interface Props {
  stops: Array<{ position: number; lat: number; lng: number; mapX: number | null; mapY: number | null; title: string }>;
  ariaLabel: string;
}

export function TripRouteMap({ stops, ariaLabel }: Props) {
  if (!stops.length) return null;
  const layout = layoutRouteMap(stops.map((s) => ({ lat: s.lat, lng: s.lng, mapX: s.mapX, mapY: s.mapY, label: s.title })));
  const path = layout.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  return (
    <figure className="vms-route">
      <svg
        className="vms-route__svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="vms-route-dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="2" className="vms-route__dot" />
          </pattern>
        </defs>
        <rect className="vms-route__bg" x="0" y="0" width={layout.width} height={layout.height} rx="28" />
        <rect x="0" y="0" width={layout.width} height={layout.height} rx="28" fill="url(#vms-route-dots)" />
        {layout.points.length > 1 && (
          <>
            <path className="vms-route__line-halo" d={path} />
            <path className="vms-route__line" d={path} />
          </>
        )}
        {layout.points.map((p, i) => {
          const stop = stops[i];
          const label = layout.labels[i];
          return (
            <a
              key={stop.position}
              href={`#stop-${stop.position}`}
              className="vms-route__stop"
              data-stop={stop.position}
              aria-label={`${stop.position}. ${stop.title}`}
            >
              <circle className="vms-route__hit" cx={p.x} cy={p.y} r="34" />
              <circle className="vms-route__marker" cx={p.x} cy={p.y} r="18" />
              <text className="vms-route__num" x={p.x} y={p.y + 7} textAnchor="middle">{stop.position}</text>
              {label && (
                <text className="vms-route__label" x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>
              )}
            </a>
          );
        })}
      </svg>
    </figure>
  );
}
