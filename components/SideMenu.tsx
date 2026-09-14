// BSA Phase 21 — a persistent, site-wide sidebar, set via vibemeasite-mcp's
// set_side_menu. href resolution (page/entity/url -> a real link) happens in
// app/layout.tsx, which already has locale/entity context — this component
// only renders an already-resolved list. No collapsed/open client state in
// v1 (Decided: no collapsible side menu yet) — plain, always-visible markup,
// left to CSS for any responsive behavior.

export interface SideMenuLink {
  label: string;
  href: string;
}

export function SideMenu({ items }: { items: SideMenuLink[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="vms-side-menu" aria-label="Section navigation">
      <ul className="vms-side-menu__list">
        {items.map((item, i) => (
          <li key={i} className="vms-side-menu__item">
            <a className="vms-side-menu__link" href={item.href}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
