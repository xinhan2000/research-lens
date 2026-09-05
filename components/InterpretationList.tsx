"use client";

import type { AnalysisResponse, AnalyticalInput } from "@/types/analytical-input";

/**
 * Right panel: validated analytical inputs from live Claude inference.
 *
 * Display only. No calculation, no ratios, no skill state — those arrive in
 * BUILD-5. Presentation helpers below format existing values; they never
 * derive new analytical facts.
 */

export type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

const UNIT_SUFFIX: Record<string, string> = {
  USD_thousands: "K",
  USD_millions: "M",
  USD_billions: "B",
};

/**
 * Formats one already-interpreted number using the input's unit and currency.
 * Performs no unit conversion and no arithmetic.
 */
function formatAmount(amount: number, input: AnalyticalInput): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (input.unit === "percent") return `${formatted}%`;
  if (input.unit === "multiple") return `${formatted}×`;

  const suffix = UNIT_SUFFIX[input.unit] ?? "";
  const symbol = input.currency === "USD" ? "$" : "";
  return `${symbol}${formatted}${suffix}`;
}

/**
 * Renders the displayable value of an analytical input.
 *
 * A ranged input carries its value in `range` rather than `value`, so both
 * bounds are shown. The range is never collapsed to a midpoint or a single
 * bound — preserving it is the point (Semantic_Input_Schema SI-9 / SV-9).
 */
function formatValue(input: AnalyticalInput): string {
  if (input.precision === "range" && input.range !== null) {
    return `${formatAmount(input.range.min, input)}–${formatAmount(
      input.range.max,
      input,
    )}`;
  }

  if (input.value !== null) {
    return formatAmount(input.value, input);
  }

  return input.precision === "qualitative" ? "Qualitative" : "No value";
}

function titleCase(token: string): string {
  return token
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Trust state uses the analyst-facing wording from PRD §17. */
const TRUST_LABEL: Record<string, string> = {
  auto: "Resolved",
  ask: "Needs Review",
  abstain: "Insufficient Evidence",
  never: "Not Permitted",
};

function InterpretationCard({
  input,
  selected,
  onSelect,
  evidenceMatched,
}: {
  input: AnalyticalInput;
  selected: boolean;
  onSelect: () => void;
  /** true = source block highlighted, false = not located, null = inactive. */
  evidenceMatched: boolean | null;
}) {
  const qualifiers = [titleCase(input.temporal_type)];
  if (input.basis !== "not_applicable") {
    qualifiers.push(titleCase(input.basis));
  }
  if (input.precision !== "exact") {
    qualifiers.push(titleCase(input.precision));
  }

  return (
    <li>
      <button
        type="button"
        className={`interp${selected ? " interp-selected" : ""}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className="interp-head">
          <span className="interp-metric">
            {input.metric}
            {input.source_label && input.source_label !== input.metric ? (
              <span className="interp-source-label"> · {input.source_label}</span>
            ) : null}
          </span>
          <span className="interp-value">{formatValue(input)}</span>
        </span>

        <span className="interp-meta">
          <span className="interp-period">{input.period ?? "Period unknown"}</span>
          <span className="interp-qualifiers">{qualifiers.join(" · ")}</span>
        </span>

        <span className={`trust trust-${input.trust_state}`}>
          {input.trust_state.toUpperCase()}
          <span className="trust-word">{TRUST_LABEL[input.trust_state]}</span>
        </span>
      </button>

      {selected ? (
        <div className="interp-detail">
          <dl className="interp-fields">
            <div>
              <dt>Period</dt>
              <dd>{input.period ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Temporal Type</dt>
              <dd>{titleCase(input.temporal_type)}</dd>
            </div>
            <div>
              <dt>Basis</dt>
              <dd>{titleCase(input.basis)}</dd>
            </div>
            <div>
              <dt>Precision</dt>
              <dd>{titleCase(input.precision)}</dd>
            </div>
            <div>
              <dt>Trust State</dt>
              <dd>{TRUST_LABEL[input.trust_state]}</dd>
            </div>
          </dl>

          {/* Source evidence is deliberately the most prominent element here —
              it outranks any model-generated label. */}
          <p className="evidence-label">Evidence</p>
          <blockquote className="evidence-text">{input.source.text}</blockquote>

          {evidenceMatched === false ? (
            <p className="evidence-unmatched">Source location not matched</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function InterpretationList({
  analysis,
  status,
  errorMessage,
  onRetry,
  selectedInputId,
  onSelectInput,
  evidenceMatched,
}: {
  analysis: AnalysisResponse | null;
  status: AnalysisStatus;
  errorMessage: string | null;
  onRetry: () => void;
  selectedInputId: string | null;
  onSelectInput: (inputId: string | null) => void;
  evidenceMatched: boolean | null;
}) {

  if (status === "analyzing") {
    return <p className="placeholder">Analyzing report…</p>;
  }

  if (status === "error") {
    return (
      <div className="analysis-error">
        <p>{errorMessage ?? "Analysis failed. Retry."}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <p className="placeholder">
        Run analysis to generate source-linked analytical inputs.
      </p>
    );
  }

  return (
    <>
      <p className="live-note">
        Live model output — validated against the AnalysisResponse schema before
        rendering.
      </p>

      <ul className="interp-list">
        {analysis.inputs.map((input) => (
          <InterpretationCard
            key={input.input_id}
            input={input}
            selected={selectedInputId === input.input_id}
            evidenceMatched={
              selectedInputId === input.input_id ? evidenceMatched : null
            }
            onSelect={() =>
              onSelectInput(
                selectedInputId === input.input_id ? null : input.input_id,
              )
            }
          />
        ))}
      </ul>

      <p className="panel-footnote">
        {analysis.inputs.length} analytical inputs ·{" "}
        {analysis.insights.length} narrative insights. Deterministic skills
        arrive in BUILD-5.
      </p>
    </>
  );
}
