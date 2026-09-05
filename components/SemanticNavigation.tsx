"use client";

import type {
  NavigationGroup,
  NavigationTarget,
} from "@/lib/navigation";

/**
 * Left-panel semantic navigation.
 *
 * Derived from the CURRENT lens content, so it never points at an item the
 * active lens has hidden. Selection state is owned by the shell — this
 * component keeps none of its own.
 */
export default function SemanticNavigation({
  groups,
  selectedInputId,
  selectedInsightId,
  onSelect,
}: {
  groups: NavigationGroup[];
  selectedInputId: string | null;
  selectedInsightId: string | null;
  onSelect: (target: NavigationTarget) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="placeholder">
        Analytical organization appears here once a report is analyzed.
      </p>
    );
  }

  function isActive(target: NavigationTarget): boolean {
    return target.kind === "input"
      ? selectedInputId === target.id
      : selectedInsightId === target.id;
  }

  return (
    <nav className="nav-groups" aria-label="Analytical organization">
      {groups.map((group) => (
        <section key={group.name} className="nav-group">
          <h3 className="nav-group-title">{group.name}</h3>
          <ul className="nav-items">
            {group.items.map((item) => (
              <li key={`${item.target.kind}:${item.target.id}`}>
                <button
                  type="button"
                  className={`nav-item${isActive(item.target) ? " nav-item-active" : ""}`}
                  onClick={() => onSelect(item.target)}
                  aria-pressed={isActive(item.target)}
                >
                  <span className="nav-item-label">{item.label}</span>
                  {item.meta ? (
                    <span className="nav-item-meta">{item.meta}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
