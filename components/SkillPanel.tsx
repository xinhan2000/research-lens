"use client";

import { formatSkillResult, SKILL_STATUS_LABEL } from "@/lib/skill-format";
import type { SkillInputReference, SkillResult } from "@/lib/skills/types";

/**
 * Deterministic Skills section of the right panel.
 *
 * Presentation only — every status and value is computed by the engine. A
 * numerical result is rendered exclusively for READY results, because a
 * non-READY `SkillResult` cannot carry one.
 */

/* Formatting lives in `lib/skill-format.ts` so the benchmark comparison renders
   identical values without duplicating the rules. */

function formatInput(reference: SkillInputReference): string {
  if (reference.value === null) return "—";
  const rounded = Number(reference.value.toFixed(2));
  return `$${rounded}M`;
}

function SkillCard({
  result,
  onSelectInput,
  selectedInputId,
}: {
  result: SkillResult;
  onSelectInput: (inputId: string) => void;
  selectedInputId: string | null;
}) {
  const isReady = result.status === "READY";

  return (
    <li className={`skill skill-${result.status.toLowerCase()}`}>
      <div className="skill-head">
        <span className="skill-name">{isReady ? result.label : result.name}</span>
        <span className={`skill-status skill-status-${result.status.toLowerCase()}`}>
          {SKILL_STATUS_LABEL[result.status]}
        </span>
      </div>

      {isReady ? (
        <p className="skill-value">{formatSkillResult(result)}</p>
      ) : (
        <p className="skill-reason">{result.reason}</p>
      )}

      {result.inputs.length > 0 ? (
        <>
          <p className="skill-section-label">
            {isReady ? "Inputs" : "Candidates"}
          </p>
          <ul className="skill-inputs">
            {result.inputs.map((reference) => (
              <li key={`${reference.inputId}-${reference.role}`}>
                {/* Reuses the BUILD-4 selection/evidence interaction. */}
                <button
                  type="button"
                  className={`skill-input${
                    selectedInputId === reference.inputId ? " skill-input-selected" : ""
                  }`}
                  onClick={() => onSelectInput(reference.inputId)}
                  title="Show this input's evidence in the report"
                >
                  <span className="skill-input-label">{reference.label}</span>
                  <span className="skill-input-value">{formatInput(reference)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {isReady ? (
        <>
          <p className="skill-section-label">Formula</p>
          <p className="skill-formula">{result.formula}</p>
        </>
      ) : null}
    </li>
  );
}

export default function SkillPanel({
  skills,
  onSelectInput,
  selectedInputId,
}: {
  skills: SkillResult[] | null;
  onSelectInput: (inputId: string) => void;
  selectedInputId: string | null;
}) {
  if (!skills) return null;

  const readyCount = skills.filter((skill) => skill.status === "READY").length;

  return (
    <section className="skills" aria-label="Deterministic skills">
      <h3 className="skills-title">
        Deterministic Skills
        <span className="skills-count">
          {readyCount} of {skills.length} ready
        </span>
      </h3>

      <ul className="skill-list">
        {skills.map((result) => (
          <SkillCard
            key={result.skillId}
            result={result}
            onSelectInput={onSelectInput}
            selectedInputId={selectedInputId}
          />
        ))}
      </ul>
    </section>
  );
}
