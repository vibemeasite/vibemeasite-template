// BSA Phase 21 — breadcrumbs are derived, not authored: the trail is built
// by the caller (app/layout.tsx) from data that already exists (the current
// page's menu label, plus an entity name when the page is entity-bound via
// bind_entity_page). This component only renders it. Renders nothing at all
// when disabled — no empty .vms-breadcrumbs shell left in the DOM.

export interface BreadcrumbItem {
  label: string;
  href?: string; // omitted on the last (current) item
}

export function Breadcrumbs({
  enabled,
  style,
  items,
}: {
  enabled: boolean;
  style: "chevron" | "slash";
  items: BreadcrumbItem[];
}) {
  if (!enabled || items.length === 0) return null;

  const separator = style === "slash" ? "/" : "›";

  return (
    <nav className="vms-breadcrumbs" aria-label="Breadcrumb">
      <ol className="vms-breadcrumbs__list">
        {items.map((item, i) => (
          <li key={i} className="vms-breadcrumbs__item">
            {item.href ? (
              <a className="vms-breadcrumbs__link" href={item.href}>
                {item.label}
              </a>
            ) : (
              <span className="vms-breadcrumbs__current" aria-current="page">
                {item.label}
              </span>
            )}
            {i < items.length - 1 ? <span className="vms-breadcrumbs__separator" aria-hidden="true">{separator}</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
