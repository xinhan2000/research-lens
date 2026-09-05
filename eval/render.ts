import type {
  Difference,
  EvalRun,
  HardBlocker,
  Ratio,
  ReportEvaluation,
} from "./types";

/**
 * Console and machine-readable rendering.
 *
 * The scorecard keeps four concerns visually separate — trusted metrics, hard
 * safety gates, benchmark metrics, comparative diagnostics — so that benchmark
 * performance is never printed as though it traded against release status.
 *
 * No ANSI colour. The output has to be readable in a plain terminal, a CI log,
 * and a pasted transcript.
 */

export const DATASET_NOTE =
  "4-report golden regression set — not a production benchmark";

function pct(ratio: Ratio): string {
  if (ratio.total === 0) {
    return ratio.manualReview
      ? `n/a (${ratio.manualReview} manual review)`
      : "n/a (0 cases)";
  }
  const value = ((ratio.passed / ratio.total) * 100).toFixed(1);
  const review = ratio.manualReview ? `, ${ratio.manualReview} manual review` : "";
  return `${ratio.passed}/${ratio.total} (${value}%${review})`;
}

function pad(label: string, width = 34): string {
  return label.length >= width ? `${label} ` : label.padEnd(width, " ");
}

function renderDifference(difference: Difference): string {
  const target = difference.expectedInputId ?? difference.actualInputId ?? "-";
  return [
    `    - [${difference.gate}] ${target} · ${difference.field}`,
    `      expected: ${difference.expected}`,
    `      actual:   ${difference.actual}`,
    `      ${difference.message}`,
  ].join("\n");
}

function renderBlocker(blocker: HardBlocker): string {
  return `  ${blocker.id} (${blocker.severity}) ${blocker.documentId} — ${blocker.title}\n    ${blocker.detail}\n    failure taxonomy: ${blocker.failureIds.join(", ")}`;
}

function renderReport(report: ReportEvaluation): string {
  const lines: string[] = [];
  const matched = report.inputScores.filter(
    (score) => score.match.status === "matched",
  ).length;

  lines.push(`${report.displayName} — ${report.pass ? "PASS" : "FAIL"}`);
  lines.push(
    `  Expected inputs: ${matched}/${report.inputScores.length} matched`,
  );

  const semantic = report.differences.filter(
    (difference) =>
      difference.gate === "critical" || difference.gate === "hard_gate",
  );
  lines.push(`  Semantic differences: ${semantic.length}`);

  if (report.skillChecks.length > 0) {
    // A skill check passes only when the state, the consumed inputs AND the
    // numerical result all agree. Marking it on state alone would show a ✓
    // beside a wrong number, which is exactly the failure mode this product
    // exists to prevent.
    const fullyPassed = (check: (typeof report.skillChecks)[number]) =>
      check.stateMatch && check.inputsMatch !== "fail" && check.resultMatch !== "fail";

    const ok = report.skillChecks.filter(fullyPassed).length;
    lines.push(`  Skill checks: ${ok}/${report.skillChecks.length}`);
    for (const check of report.skillChecks) {
      const notes: string[] = [];
      if (!check.stateMatch) notes.push("state");
      if (check.inputsMatch === "fail") notes.push("consumed inputs");
      if (check.resultMatch === "fail") {
        notes.push(`result ${check.actualResult} != ${check.expectedResult}`);
      }
      lines.push(
        `    ${fullyPassed(check) ? "✓" : "✗"} ${check.skillId}: ${check.detail}` +
          (notes.length > 0 ? ` [${notes.join("; ")}]` : ""),
      );
    }
  }

  for (const check of report.behaviorChecks) {
    const mark =
      check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "?";
    lines.push(`  ${mark} ${check.name}`);
    if (check.status !== "pass") lines.push(`      ${check.detail}`);
  }

  for (const check of report.resolutionChecks) {
    const mark = check.status === "pass" ? "✓" : "✗";
    lines.push(
      `  ${mark} resolution ${check.selectedExpectedInputId}: ${check.detail}`,
    );
  }

  if (report.extraActualInputIds.length > 0) {
    lines.push(
      `  extra_actual_input: ${report.extraActualInputIds.length} (diagnostic)`,
    );
  }

  lines.push(
    `  Safety blockers: ${report.blockers.length === 0 ? "none" : report.blockers.map((b) => b.id).join(", ")}`,
  );

  if (report.unsafeAutoUse.length > 0) {
    lines.push(`  Unsafe auto-use cases: ${report.unsafeAutoUse.length}`);
    for (const entry of report.unsafeAutoUse) {
      lines.push(`    ! ${entry.skillId} <- ${entry.actualInputId ?? "?"}: ${entry.reason}`);
    }
  }

  if (semantic.length > 0) {
    lines.push("  Differences:");
    for (const difference of semantic) lines.push(renderDifference(difference));
  }

  if (report.benchmarkError) {
    lines.push(`  Benchmark: infrastructure failure — ${report.benchmarkError}`);
  }

  return lines.join("\n");
}

export function renderConsole(run: EvalRun): string {
  const out: string[] = [];

  out.push("Research Lens Eval");
  out.push(run.datasetNote);
  out.push(`Model: ${run.model}`);
  out.push(`Mode: ${run.mode}`);
  out.push(`Benchmark: ${run.benchmarkEnabled ? "ON" : "OFF"}`);
  out.push("");

  for (const report of run.reports) {
    out.push(renderReport(report));
    out.push("");
  }

  const metrics = run.trustedMetrics;
  out.push("RESEARCH LENS TRUSTED METRICS");
  out.push(`  ${pad("Expected input match coverage")}${pct(metrics.expectedInputMatchCoverage)}`);
  out.push(`  ${pad("Metric identity accuracy")}${pct(metrics.metricIdentityAccuracy)}`);
  out.push(`  ${pad("Economic value accuracy")}${pct(metrics.economicValueAccuracy)}`);
  out.push(`  ${pad("Range accuracy")}${pct(metrics.rangeAccuracy)}`);
  out.push(`  ${pad("Unit accuracy")}${pct(metrics.unitAccuracy)}`);
  out.push(`  ${pad("Currency accuracy")}${pct(metrics.currencyAccuracy)}`);
  out.push(`  ${pad("Period accuracy")}${pct(metrics.periodAccuracy)}`);
  out.push(`  ${pad("Temporal-type accuracy")}${pct(metrics.temporalTypeAccuracy)}`);
  out.push(`  ${pad("Basis accuracy")}${pct(metrics.basisAccuracy)}`);
  out.push(`  ${pad("Precision accuracy")}${pct(metrics.precisionAccuracy)}`);
  out.push(`  ${pad("Evidence validity")}${pct(metrics.evidenceValidity)}`);
  out.push(`  ${pad("Ground-Truth evidence agreement")}${pct(metrics.groundTruthEvidenceAgreement)}`);
  out.push(`  ${pad("Trust-decision accuracy")}${pct(metrics.trustDecisionAccuracy)}`);
  out.push(`  ${pad("Conflict detection checks")}${pct(metrics.conflictDetectionChecks)}`);
  out.push(`  ${pad("Skill gate accuracy")}${pct(metrics.skillGateAccuracy)}`);
  out.push(`  ${pad("Deterministic result accuracy")}${pct(metrics.deterministicResultAccuracy)}`);
  out.push(`  ${pad("Behaviour checks")}${pct(metrics.behaviorChecks)}`);
  out.push(`  ${pad("Resolution checks")}${pct(metrics.resolutionChecks)}`);
  out.push(
    `  ${pad("Unsafe auto-use")}${metrics.unsafeAutoUseCount} / ${metrics.checkedConsequentialSkillCases} consequential cases` +
      (metrics.unsafeAutoUseRate === null
        ? ""
        : ` (${(metrics.unsafeAutoUseRate * 100).toFixed(2)}%)`),
  );
  out.push(`  ${pad("Unsupported consequential inputs")}${metrics.unsupportedConsequentialInputCount}`);
  out.push(`  ${pad("Extra actual inputs (diagnostic)")}${metrics.extraActualInputCount}`);
  out.push(
    "  Denominator: one case = one (READY Skill, consumed input) pair. Non-READY",
  );
  out.push("  skills contribute to neither side — no input reached a calculation.");
  out.push("  Four reports cannot support a claim of statistical significance.");
  out.push("");

  out.push("HARD SAFETY GATES");
  if (run.hardBlockers.length === 0) {
    out.push("PASS — none triggered");
  } else {
    out.push(`FAIL — ${run.hardBlockers.length} blocker(s)`);
    for (const blocker of run.hardBlockers) out.push(renderBlocker(blocker));
  }
  out.push("");

  out.push("AI-ONLY BENCHMARK");
  if (!run.benchmarkEnabled) {
    out.push("SKIPPED");
  } else if (!run.benchmark) {
    out.push("NO RESULTS — see benchmark infrastructure failures below");
  } else {
    out.push(`  ${pad("Answer coverage")}${pct(run.benchmark.answerCoverage)}`);
    out.push(`  ${pad("Numerical correctness")}${pct(run.benchmark.numericalCorrectness)}`);
    out.push(`  ${pad("Manual-review cases")}${run.benchmark.manualReviewCases}`);
    out.push(`  ${pad("Unsafe direct-answer cases")}${run.benchmark.unsafeDirectAnswerCases}`);
    out.push(`  ${pad("Benchmark-vs-trusted disagreements")}${run.benchmark.disagreementCases}`);
    out.push("  These metrics are comparative evidence. None of them is a release gate.");
  }
  if (run.benchmarkInfrastructureFailures.length > 0) {
    out.push("  Benchmark infrastructure failures (not a trusted-path failure):");
    for (const failure of run.benchmarkInfrastructureFailures) {
      out.push(`    - ${failure}`);
    }
  }
  out.push("");

  if (run.benchmarkEnabled && run.comparativeDiagnostics.length > 0) {
    out.push("COMPARATIVE DIAGNOSTICS");
    out.push("  Same answer does not mean same guarantee.");
    for (const diagnostic of run.comparativeDiagnostics) {
      if (diagnostic.category === "no_disagreement") continue;
      out.push(
        `  ${diagnostic.documentId} · ${diagnostic.taskId} · ${diagnostic.category}`,
      );
      out.push(`    ${diagnostic.detail}`);
    }
    out.push("  Disagreement is diagnostic, not automatically a defect on either side.");
    out.push("");
  }

  out.push("RELEASE STATUS");
  out.push(run.releaseStatus);
  out.push(
    run.releaseStatus === "PASS"
      ? "  Trusted Research Lens path passed the golden regression set."
      : "  Trusted Research Lens path failed. Benchmark performance cannot change this.",
  );

  return out.join("\n");
}

/* ------------------------------------------------------------------ *
 * Machine-readable result
 * ------------------------------------------------------------------ */

/**
 * Builds the result JSON.
 *
 * Contains no API key, no environment values, no request headers, and no raw
 * Anthropic transport objects. Validated AnalysisResponse snapshots are written
 * separately, into the gitignored run directory, so a result file can be shared
 * without carrying a full model response.
 */
export function buildResultJson(run: EvalRun): Record<string, unknown> {
  return {
    schemaVersion: run.schemaVersion,
    runAt: run.runAt,
    mode: run.mode,
    model: run.model,
    benchmarkEnabled: run.benchmarkEnabled,
    datasetNote: run.datasetNote,
    reports: run.reports.map((report) => ({
      documentId: report.documentId,
      scenario: report.scenario,
      source: report.source,
      pass: report.pass,
      matchedInputs: report.inputScores.filter((s) => s.match.status === "matched").length,
      expectedInputs: report.inputScores.length,
      inputScores: report.inputScores.map((score) => ({
        expectedInputId: score.expectedInputId,
        actualInputId: score.actualInputId,
        matchStatus: score.match.status,
        fields: score.fields,
      })),
      extraActualInputIds: report.extraActualInputIds,
      differences: report.differences,
      behaviorChecks: report.behaviorChecks,
      skillChecks: report.skillChecks,
      resolutionChecks: report.resolutionChecks,
      unsafeAutoUse: report.unsafeAutoUse,
      checkedConsequentialSkillCases: report.checkedConsequentialSkillCases,
      blockers: report.blockers,
      skillStates: report.skills.map((skill) => ({
        skillId: skill.skillId,
        status: skill.status,
        value: skill.value ?? null,
        label: skill.label,
        inputIds: skill.inputIds,
      })),
      benchmarkError: report.benchmarkError,
    })),
    trustedMetrics: run.trustedMetrics,
    hardBlockers: run.hardBlockers,
    releaseStatus: run.releaseStatus,
    benchmark: run.benchmark,
    comparativeDiagnostics: run.comparativeDiagnostics,
    benchmarkInfrastructureFailures: run.benchmarkInfrastructureFailures,
  };
}
