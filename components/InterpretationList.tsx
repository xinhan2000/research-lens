"use client";

import { useState } from "react";

import type { AnalysisResponse, AnalyticalInput } from "@/types/analytical-input";

/**
 * Right panel: validated analytical inputs.
 *
 * Display only. No calculation, no ratios, no skill state — those arrive in
 * BUILD-5. Presentation helpers below format existing values; they never
 * derive new analytical facts.
 */

const UNIT_SUFFIX: Record<string, string> = {
  USD_thousands: "K",
  USD_millions: "M",
  USD_billions: "B",
};

/** Formats an already-interpreted value. Performs no unit conversion. */
function formatValue(input: AnalyticalInput): string {
  if (input.value === null) {
    return input.precision === "qualitative" ? "Qualitative" : "No value";
  }

  const amount = input.value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (input.unit === "percent") return `${amount}%`;
  if (input.unit === "multiple") return `${amount}×`;

  const suffix = UNIT_SUFFIX[input.unit] ?? "";
  const symbol = input.currency === "USD" ? "$" : "";
  return `${symbol}${amount}${suffix}`;
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
}: {
  input: AnalyticalInput;
  selected: boolean;
  onSelect: () => void;
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
    </li>
  );
}

export default function InterpretationList({
  analysis,
}: {
  analysis: AnalysisResponse | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!analysis) {
    return (
      <p className="placeholder">
        Interpretation fixture not available for this report yet.
      </p>
    );
  }

  return (
    <>
      <p className="fixture-note">
        Development fixture — not live model output. Validated against the
        AnalysisResponse schema before rendering.
      </p>

      <ul className="interp-list">
        {analysis.inputs.map((input) => (
          <InterpretationCard
            key={input.input_id}
            input={input}
            selected={selectedId === input.input_id}
            onSelect={() =>
              setSelectedId((current) =>
                current === input.input_id ? null : input.input_id,
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
