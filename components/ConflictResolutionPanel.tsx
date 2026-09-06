"use client";

import type {
  AnalystInputResolution,
  BasisConflictGroup,
} from "@/lib/skills/resolution";
import type { AnalyticalInput } from "@/types/analytical-input";

/**
 * Analyst resolution of a reviewable EBITDA basis conflict.
 *
 * One panel, not a control buried inside each skill card: the analyst is
 * answering a single semantic question that several skills depend on.
 *
 * The panel stays visible after selection so the competing definition, its
 * evidence, and the ability to switch all remain inspectable. Switching is
 * local and deterministic — no model call.
 */

function formatCandidate(input: AnalyticalInput): string {
  if (input.value === null) return "—";
  const amount = input.value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const suffix =
    input.unit === "USD_thousands"
      ? "K"
      : input.unit === "USD_millions"
        ? "M"
        : input.unit === "USD_billions"
          ? "B"
          : "";
  const symbol = input.currency === "USD" ? "$" : "";
  return `${symbol}${amount}${suffix}`;
}

/**
 * Display names for the bases this panel can offer.
 *
 * The label always reflects the basis the model actually emitted. A GAAP
 * candidate reads "GAAP EBITDA" — never "Reported EBITDA" — because the analyst
 * is choosing between the definitions the report supports, and mislabelling one
 * would misrepresent the choice being made.
 */
const BASIS_LABEL: Partial<Record<AnalyticalInput["basis"], string>> = {
  adjusted: "Adjusted",
  reported: "Reported",
  gaap: "GAAP",
};

function basisLabel(input: AnalyticalInput): string {
  return (
    BASIS_LABEL[input.basis] ??
    input.basis.charAt(0).toUpperCase() + input.basis.slice(1)
  );
}

export default function ConflictResolutionPanel({
  conflict,
  resolution,
  onResolve,
  onShowEvidence,
  selectedInputId,
}: {
  conflict: BasisConflictGroup;
  resolution: AnalystInputResolution | null;
  onResolve: (resolution: AnalystInputResolution) => void;
  onShowEvidence: (inputId: string) => void;
  selectedInputId: string | null;
}) {
  return (
    <section className="resolve" aria-label="Analyst resolution">
      <h3 className="resolve-title">Analyst Resolution</h3>

      <p className="resolve-note">
        Multiple valid {conflict.period} EBITDA definitions were found. Choose
        which basis dependent calculations should use. Nothing is selected by
        default.
      </p>

      <ul className="resolve-list">
        {/* Document order is preserved: no ordering by value, and no candidate
            is styled as recommended. */}
        {conflict.candidates.map((candidate) => {
          const chosen = resolution?.selectedInputId === candidate.input_id;
          return (
            <li
              key={candidate.input_id}
              className={`resolve-card${chosen ? " resolve-card-chosen" : ""}`}
            >
              <div className="resolve-head">
                <span className="resolve-basis">
                  {basisLabel(candidate)} EBITDA
                </span>
                <span className="resolve-value">
                  {formatCandidate(candidate)}
                </span>
              </div>
              <p className="resolve-period">{candidate.period}</p>

              <div className="resolve-actions">
                <button
                  type="button"
                  className={`resolve-evidence${
                    selectedInputId === candidate.input_id
                      ? " resolve-evidence-active"
                      : ""
                  }`}
                  onClick={() => onShowEvidence(candidate.input_id)}
                >
                  Show evidence
                </button>

                {chosen ? (
                  <span className="resolve-chosen">Selected by analyst</span>
                ) : (
                  <button
                    type="button"
                    className="resolve-use"
                    onClick={() =>
                      onResolve({
                        family: conflict.family,
                        period: conflict.period,
                        selectedInputId: candidate.input_id,
                      })
                    }
                  >
                    Use {basisLabel(candidate)}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {resolution ? (
        <p className="resolve-status">
          Analyst selected:{" "}
          {basisLabel(
            conflict.candidates.find(
              (c) => c.input_id === resolution.selectedInputId,
            ) ?? conflict.candidates[0],
          )}{" "}
          EBITDA. Dependent skills recalculated deterministically.
        </p>
      ) : null}
    </section>
  );
}
