"use client";

import { useState } from "react";

import {
  CORRECTABLE_PRECISIONS,
  parseCorrection,
  type AnalystCorrection,
  type CorrectablePrecision,
} from "@/lib/corrections/schema";
import { basisSchema, temporalTypeSchema } from "@/lib/analysis-schema";
import type { AnalyticalInput } from "@/types/analytical-input";

/**
 * Analyst correction of one interpreted input.
 *
 * The form is deliberately explicit: no unit parsing, no period normalization,
 * no arithmetic. A value is entered in the input's EXISTING unit, which is
 * shown read-only, so "100" on a USD_millions input means 100 USD millions and
 * nothing is inferred from what was typed.
 *
 * Evidence is shown unchanged. A correction never rewrites what the report said.
 */

function titleCase(token: string): string {
  return token
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CorrectionDialog({
  input,
  original,
  existing,
  onSave,
  onReset,
  onClose,
}: {
  /** Current effective input (already carrying any prior correction). */
  input: AnalyticalInput;
  /** The untouched model interpretation, shown for comparison. */
  original: AnalyticalInput;
  existing: AnalystCorrection | null;
  onSave: (correction: AnalystCorrection) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(
    input.value === null ? "" : String(input.value),
  );
  const [period, setPeriod] = useState(input.period ?? "");
  const [temporalType, setTemporalType] = useState(input.temporal_type);
  const [basis, setBasis] = useState(input.basis);
  const [precision, setPrecision] = useState<CorrectablePrecision>(
    (CORRECTABLE_PRECISIONS as readonly string[]).includes(input.precision)
      ? (input.precision as CorrectablePrecision)
      : "exact",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = value.trim();
    let parsedValue: number | null;
    if (trimmed === "") {
      parsedValue = null;
    } else {
      const asNumber = Number(trimmed);
      if (!Number.isFinite(asNumber)) {
        setError("Enter a finite number, or leave blank for no value.");
        return;
      }
      parsedValue = asNumber;
    }

    const correction = parseCorrection({
      inputId: input.input_id,
      changes: {
        value: parsedValue,
        period,
        temporal_type: temporalType,
        basis,
        precision,
      },
      correctedAt: new Date().toISOString(),
    });

    if (!correction) {
      setError("That correction is not valid for this input.");
      return;
    }

    onSave(correction);
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Correct interpretation"
      onClick={onClose}
    >
      <div
        className="dialog correction-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">Correct interpretation</h2>

        <dl className="correction-readonly">
          <div>
            <dt>Metric</dt>
            <dd>{input.metric}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{input.unit}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{input.currency ?? "—"}</dd>
          </div>
        </dl>
        <p className="correction-hint">
          Metric, unit, currency, evidence and trust state are not editable.
          Values are entered in the unit shown above.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="dialog-label" htmlFor="correction-value">
            Value{" "}
            <span className="correction-original">
              (AI: {original.value === null ? "none" : original.value})
            </span>
          </label>
          <input
            id="correction-value"
            className="dialog-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />

          <label className="dialog-label" htmlFor="correction-period">
            Period{" "}
            <span className="correction-original">
              (AI: {original.period ?? "none"})
            </span>
          </label>
          <input
            id="correction-period"
            className="dialog-input"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            autoComplete="off"
          />

          <label className="dialog-label" htmlFor="correction-temporal">
            Temporal Type{" "}
            <span className="correction-original">
              (AI: {titleCase(original.temporal_type)})
            </span>
          </label>
          <select
            id="correction-temporal"
            className="dialog-input"
            value={temporalType}
            onChange={(event) =>
              setTemporalType(
                event.target.value as AnalyticalInput["temporal_type"],
              )
            }
          >
            {temporalTypeSchema.options.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>

          <label className="dialog-label" htmlFor="correction-basis">
            Basis{" "}
            <span className="correction-original">
              (AI: {titleCase(original.basis)})
            </span>
          </label>
          <select
            id="correction-basis"
            className="dialog-input"
            value={basis}
            onChange={(event) =>
              setBasis(event.target.value as AnalyticalInput["basis"])
            }
          >
            {basisSchema.options.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>

          <label className="dialog-label" htmlFor="correction-precision">
            Precision{" "}
            <span className="correction-original">
              (AI: {titleCase(original.precision)})
            </span>
          </label>
          <select
            id="correction-precision"
            className="dialog-input"
            value={precision}
            onChange={(event) =>
              setPrecision(event.target.value as CorrectablePrecision)
            }
          >
            {CORRECTABLE_PRECISIONS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>

          <p className="evidence-label">Evidence (unchanged)</p>
          <blockquote className="evidence-text">{input.source.text}</blockquote>

          {error ? <p className="correction-error">{error}</p> : null}

          <div className="dialog-actions">
            {existing ? (
              <button type="button" onClick={onReset}>
                Reset to AI interpretation
              </button>
            ) : null}
            <span className="dialog-spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Save correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
