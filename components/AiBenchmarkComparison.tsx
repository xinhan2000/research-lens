"use client";

import {
  AI_BENCHMARK_TASK_IDS,
  AI_BENCHMARK_TASK_NAMES,
  type AiBenchmarkResponse,
} from "@/lib/ai-benchmark-schema";
import { BENCHMARK_TASK_TO_SKILL_ID } from "@/lib/benchmark-skill-map";
import { formatSkillResult, SKILL_STATUS_LABEL } from "@/lib/skill-format";
import type { SkillResult } from "@/lib/skills/types";

/**
 * Compact six-row comparison: what the model answered directly, beside what the
 * product was willing to trust and execute.
 *
 * Display only. Skill results are read, never modified, and a benchmark answer
 * is never parsed, recalculated, or judged here.
 */

export type BenchmarkStatus = "idle" | "running" | "success" | "error";

function BenchmarkRow({
  taskId,
  benchmark,
  skill,
}: {
  taskId: (typeof AI_BENCHMARK_TASK_IDS)[number];
  benchmark: AiBenchmarkResponse | null;
  skill: SkillResult | undefined;
}) {
  const item = benchmark?.items.find((entry) => entry.task_id === taskId);
  const isReady = skill?.status === "READY";

  return (
    <li className="cmp-row">
      <p className="cmp-task">{AI_BENCHMARK_TASK_NAMES[taskId]}</p>

      <div className="cmp-cells">
        {/* AI-only side. Never styled as success; never given a skill status. */}
        <div className="cmp-cell cmp-cell-ai">
          <p className="cmp-cell-head">
            AI-only benchmark
            <span className="cmp-unverified">UNVERIFIED</span>
          </p>
          {item ? (
            <>
              <p
                className={`cmp-answer${item.answer === null ? " cmp-answer-none" : ""}`}
              >
                {item.answer ?? "No direct answer"}
              </p>
              <p className="cmp-explanation">{item.explanation}</p>
            </>
          ) : (
            <p className="cmp-answer cmp-answer-none">Not run</p>
          )}
        </div>

        {/* Deterministic side. A value appears only for READY. */}
        <div className="cmp-cell cmp-cell-skill">
          <p className="cmp-cell-head">
            Deterministic Skill
            {skill ? (
              <span
                className={`cmp-status cmp-status-${skill.status.toLowerCase()}`}
              >
                {SKILL_STATUS_LABEL[skill.status]}
              </span>
            ) : null}
          </p>
          {skill ? (
            isReady ? (
              <>
                <p className="cmp-answer">{formatSkillResult(skill)}</p>
                <p className="cmp-explanation">{skill.label}</p>
              </>
            ) : (
              <>
                <p className="cmp-answer cmp-answer-none">No result</p>
                <p className="cmp-explanation">{skill.reason}</p>
              </>
            )
          ) : (
            <p className="cmp-answer cmp-answer-none">Unavailable</p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AiBenchmarkComparison({
  benchmark,
  benchmarkStatus,
  benchmarkError,
  skills,
  onRunBenchmark,
}: {
  benchmark: AiBenchmarkResponse | null;
  benchmarkStatus: BenchmarkStatus;
  benchmarkError: string | null;
  skills: SkillResult[];
  onRunBenchmark: () => void;
}) {
  const running = benchmarkStatus === "running";

  return (
    <section className="cmp" aria-label="AI-only benchmark comparison">
      <h3 className="cmp-title">
        AI-Only Benchmark
        <button
          type="button"
          className="cmp-run"
          onClick={onRunBenchmark}
          disabled={running}
        >
          {running
            ? "Running AI-only benchmark…"
            : benchmark
              ? "Re-run AI-only"
              : "Compare with AI-only"}
        </button>
      </h3>

      {benchmarkStatus === "idle" && !benchmark ? (
        <p className="cmp-note">
          Ask the same model to answer all six analytical tasks directly from
          the report, in one request, and compare with the deterministic
          results below.
        </p>
      ) : null}

      {benchmarkStatus === "error" ? (
        <p className="cmp-error">
          {benchmarkError ?? "AI-only benchmark failed. Retry."}
        </p>
      ) : null}

      {benchmark ? (
        <>
          <p className="cmp-note">
            One model call, six direct answers. Unverified: no structured
            interpretation, no trust gates, no deterministic execution.
          </p>
          <ul className="cmp-list">
            {AI_BENCHMARK_TASK_IDS.map((taskId) => (
              <BenchmarkRow
                key={taskId}
                taskId={taskId}
                benchmark={benchmark}
                skill={skills.find(
                  (s) => s.skillId === BENCHMARK_TASK_TO_SKILL_ID[taskId],
                )}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
