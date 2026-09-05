"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AiBenchmarkComparison, {
  type BenchmarkStatus,
} from "@/components/AiBenchmarkComparison";
import ApiKeyDialog from "@/components/ApiKeyDialog";
import ConflictResolutionPanel from "@/components/ConflictResolutionPanel";
import CorrectionDialog from "@/components/CorrectionDialog";
import InterpretationList from "@/components/InterpretationList";
import ReportViewer from "@/components/ReportViewer";
import SemanticNavigation from "@/components/SemanticNavigation";
import SkillPanel from "@/components/SkillPanel";
import {
  buildBenchmarkRequestBody,
  type AiBenchmarkResponse,
} from "@/lib/ai-benchmark-schema";
import { clearApiKey, readApiKey, saveApiKey } from "@/lib/api-key";
import {
  applyCorrections,
  withCorrection,
  withoutCorrection,
} from "@/lib/corrections/apply-corrections";
import type {
  AnalystCorrection,
  CorrectionsById,
} from "@/lib/corrections/schema";
import {
  buildNavigation,
  getLensContent,
  LENSES,
  type LensId,
  type NavigationTarget,
} from "@/lib/navigation";
import { runSkills } from "@/lib/skills/engine";
import {
  findResolvableBasisConflict,
  type AnalystInputResolution,
} from "@/lib/skills/resolution";
import type { AnalysisResponse } from "@/types/analytical-input";
import type { SampleReport } from "@/types/report";

/** One Claude call is one operation — no fabricated sub-stages. */
type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

export default function ResearchLensShell({
  reports,
}: {
  reports: SampleReport[];
}) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [evidenceMatched, setEvidenceMatched] = useState<boolean | null>(null);

  /**
   * AI-only benchmark state.
   *
   * Deliberately separate from `analysis` / `status` / `errorMessage`. A
   * benchmark failure never clears the analysis, never changes the analysis
   * status, and never touches deterministic skill results — and the skills
   * never read any of this.
   */
  const [benchmark, setBenchmark] = useState<AiBenchmarkResponse | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<BenchmarkStatus>("idle");
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  /**
   * Analyst resolution of a reviewable semantic conflict.
   *
   * Starts null and is only ever set by an explicit click. No effect, default,
   * or heuristic chooses a basis, and the AI-only benchmark never influences it.
   */
  const [analystResolution, setAnalystResolution] =
    useState<AnalystInputResolution | null>(null);

  /**
   * Analyst corrections, keyed by input id.
   *
   * An overlay on the immutable model interpretation — `analysis` is never
   * rewritten, so the original is always available for comparison and reset.
   */
  const [corrections, setCorrections] = useState<CorrectionsById>({});
  /** Input id whose correction dialog is open, or null. */
  const [correctingInputId, setCorrectingInputId] = useState<string | null>(null);

  /** Active lens. Local presentation state — never reaches trusted execution. */
  const [activeLens, setActiveLens] = useState<LensId>("all");
  /** Only one evidence target is active at a time: an input OR an insight. */
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];

  /**
   * Deterministic skill results. Pure function of the validated inputs, so it
   * recomputes only when the analysis changes — no model call is involved.
   */
  /**
   * The effective session inputs: model interpretation plus analyst overlay.
   *
   * Everything downstream derives from this, which is what makes a stale result
   * structurally impossible — skill results have no independent lifetime.
   */
  const effectiveInputs = useMemo(
    () => (analysis ? applyCorrections(analysis.inputs, corrections) : null),
    [analysis, corrections],
  );

  const skills = useMemo(
    () => (effectiveInputs ? runSkills(effectiveInputs, analystResolution) : null),
    [effectiveInputs, analystResolution],
  );

  /**
   * A resolvable EBITDA basis conflict, if the analysis contains one.
   *
   * Purely structural detection over the validated inputs — no document id, no
   * report-specific branching. Report D's period ambiguity produces none.
   */
  const basisConflict = useMemo(
    () => (effectiveInputs ? findResolvableBasisConflict(effectiveInputs) : null),
    [effectiveInputs],
  );

  /**
   * Lens-visible content.
   *
   * Analytical inputs come from `effectiveInputs`, so a corrected value is
   * never displayed as the original. Narrative insights come from the original
   * AI output: corrections affect the current analytical inputs; narrative
   * insights remain source-derived AI interpretations and are never rewritten.
   *
   * Derived AFTER effectiveInputs exist, purely for presentation. No lens value
   * reaches runSkills, findResolvableBasisConflict, or applyCorrections.
   */
  const lensContent = useMemo(
    () =>
      getLensContent(
        activeLens,
        effectiveInputs ?? [],
        analysis?.insights ?? [],
      ),
    [activeLens, effectiveInputs, analysis],
  );

  /** Navigation follows the current lens, so it never targets hidden content. */
  const navigationGroups = useMemo(
    () => (analysis ? buildNavigation(lensContent) : []),
    [analysis, lensContent],
  );

  /** Evidence of the active interpretation, handed to the report panel. */
  const activeEvidence =
    (selectedInsightId
      ? analysis?.insights.find((i) => i.id === selectedInsightId)?.sourceText
      : analysis?.inputs.find((i) => i.input_id === selectedInputId)?.source
          .text) ?? null;

  /** Selecting an input clears any selected insight, and vice versa. */
  function handleSelectInput(inputId: string | null) {
    setSelectedInputId(inputId);
    setSelectedInsightId(null);
  }

  function handleSelectInsight(insightId: string | null) {
    setSelectedInsightId(insightId);
    setSelectedInputId(null);
  }

  function handleSelectNavigation(target: NavigationTarget) {
    if (target.kind === "input") handleSelectInput(target.id);
    else handleSelectInsight(target.id);
  }

  /**
   * Switching lens clears the active evidence target and any open correction
   * dialog, so a hidden item cannot leave an unrelated source block
   * highlighted. Analysis, corrections, resolution, benchmark and skills are
   * deliberately untouched.
   */
  function handleSelectLens(lens: LensId) {
    setActiveLens(lens);
    setSelectedInputId(null);
    setSelectedInsightId(null);
    setEvidenceMatched(null);
    setCorrectingInputId(null);
  }

  // Stable identity keeps the report panel's match effect from re-running.
  const handleMatchResult = useCallback((matched: boolean | null) => {
    setEvidenceMatched(matched);
  }, []);

  // sessionStorage is unavailable during server render.
  useEffect(() => {
    setKeyConfigured(readApiKey() !== null);
  }, []);

  /**
   * Clears the benchmark without re-running it. Used on report switch and when
   * a fresh analysis starts, so an old benchmark is never paired with new
   * results. Re-running is always an explicit user choice.
   */
  function clearBenchmark() {
    setBenchmark(null);
    setBenchmarkStatus("idle");
    setBenchmarkError(null);
  }

  /** Switching reports must never leave another report's analysis on screen. */
  function handleSelectReport(id: string) {
    setSelectedId(id);
    setAnalysis(null);
    setStatus("idle");
    setErrorMessage(null);
    setSelectedInputId(null);
    setEvidenceMatched(null);
    clearBenchmark();
    setAnalystResolution(null);
    setCorrections({});
    setCorrectingInputId(null);
    setSelectedInsightId(null);
    setActiveLens("all");
    setSelectedInsightId(null);
    setActiveLens("all");
  }

  const handleAnalyze = useCallback(async () => {
    const apiKey = readApiKey();
    if (!apiKey) {
      setKeyConfigured(false);
      setStatus("error");
      setErrorMessage("Anthropic API key required to analyze this report.");
      setDialogOpen(true);
      return;
    }

    setStatus("analyzing");
    setErrorMessage(null);
    setAnalysis(null);
    setSelectedInputId(null);
    setEvidenceMatched(null);
    // A stale benchmark must not be shown beside a new analysis run.
    clearBenchmark();
    // Input ids change between runs, so a previous selection or correction must
    // not carry silently into new model output.
    setAnalystResolution(null);
    setCorrections({});
    setCorrectingInputId(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          documentId: selected.id,
          reportText: selected.content,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(payload?.error?.message ?? "Analysis failed. Retry.");
        return;
      }

      setAnalysis(payload.analysis as AnalysisResponse);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Analysis failed. Retry.");
    }
  }, [selected]);

  /**
   * Runs the AI-only benchmark: one click, one fetch, one Anthropic call.
   *
   * The request carries the API key and the report text only — no analysis, no
   * interpretations, no skill results, no trust or conflict state, no Ground
   * Truth. The body is built by `buildBenchmarkRequestBody` so that boundary is
   * testable in one place.
   */
  const handleRunBenchmark = useCallback(async () => {
    // Guard against a duplicate click racing the disabled attribute.
    if (benchmarkStatus === "running") return;

    const apiKey = readApiKey();
    if (!apiKey) {
      setKeyConfigured(false);
      setBenchmarkStatus("error");
      setBenchmarkError(
        "Anthropic API key required to run the AI-only benchmark.",
      );
      setDialogOpen(true);
      return;
    }

    setBenchmarkStatus("running");
    setBenchmarkError(null);
    setBenchmark(null);

    try {
      const response = await fetch("/api/ai-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildBenchmarkRequestBody(apiKey, selected.content),
        ),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setBenchmarkStatus("error");
        setBenchmarkError(
          payload?.error?.message ?? "AI-only benchmark failed. Retry.",
        );
        return;
      }

      setBenchmark(payload.benchmark as AiBenchmarkResponse);
      setBenchmarkStatus("success");
    } catch {
      setBenchmarkStatus("error");
      setBenchmarkError("AI-only benchmark failed. Retry.");
    }
  }, [benchmarkStatus, selected]);

  /**
   * Saves a correction.
   *
   * Also clears any analyst resolution: a correction can change the period,
   * basis, or value that made a resolution valid, and a stale human decision is
   * as dangerous as a stale model result. Rather than attempt dependency
   * analysis, BUILD-7 fails safe and asks the analyst to resolve again.
   *
   * The AI-only benchmark is deliberately NOT cleared — it answered the
   * original report, which is exactly what makes the comparison meaningful.
   */
  function handleSaveCorrection(correction: AnalystCorrection) {
    setCorrections((current) => withCorrection(current, correction));
    setAnalystResolution(null);
    setCorrectingInputId(null);
  }

  function handleResetCorrection(inputId: string) {
    setCorrections((current) => withoutCorrection(current, inputId));
    setAnalystResolution(null);
    setCorrectingInputId(null);
  }

  const analyzing = status === "analyzing";
  const benchmarking = benchmarkStatus === "running";

  return (
    <div className="shell">
      <header className="header">
        <div className="header-identity">
          <span className="product">Research Lens</span>
          <span className="badge">Demo</span>
          <span className="selected" title={selected.fileName}>
            {selected.title}
          </span>
        </div>

        <div className="header-actions">
          <label className="selector">
            <span className="selector-label">Sample report</span>
            <select
              value={selected.id}
              onChange={(event) => handleSelectReport(event.target.value)}
              disabled={analyzing || benchmarking}
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={() => setDialogOpen(true)}>
            {keyConfigured ? "Replace Key" : "Set Anthropic API Key"}
          </button>
          <span className={`key-state${keyConfigured ? " key-state-on" : ""}`}>
            {keyConfigured ? "Configured" : "Not configured"}
          </span>

          <button
            type="button"
            className="primary"
            onClick={handleAnalyze}
            disabled={analyzing || benchmarking}
          >
            {analyzing ? "Analyzing…" : "Analyze Report"}
          </button>
        </div>
      </header>

      <nav className="lens-row" aria-label="Analytical lenses">
        {LENSES.map((lens) => (
          <button
            key={lens.id}
            type="button"
            className={`lens${activeLens === lens.id ? " lens-active" : ""}`}
            onClick={() => handleSelectLens(lens.id)}
            aria-pressed={activeLens === lens.id}
          >
            {lens.label}
          </button>
        ))}
      </nav>

      <main className="panels">
        <section className="panel panel-nav" aria-label="Semantic navigation">
          <h2 className="panel-title">Semantic Navigation</h2>
          <SemanticNavigation
            groups={navigationGroups}
            selectedInputId={selectedInputId}
            selectedInsightId={selectedInsightId}
            onSelect={handleSelectNavigation}
          />
        </section>

        <section className="panel panel-report" aria-label="Original report">
          <h2 className="panel-title">
            Original Report
            <span className="panel-meta">{selected.fileName}</span>
          </h2>
          <ReportViewer
            report={selected}
            evidenceText={activeEvidence}
            onMatchResult={handleMatchResult}
          />
        </section>

        <section className="panel panel-analysis" aria-label="Analysis and skills">
          <h2 className="panel-title">Analysis / Skills</h2>
          <InterpretationList
            analysis={analysis}
            status={status}
            errorMessage={errorMessage}
            onRetry={handleAnalyze}
            selectedInputId={selectedInputId}
            onSelectInput={handleSelectInput}
            evidenceMatched={evidenceMatched}
            visibleInputs={lensContent.inputs}
            visibleInsights={lensContent.insights}
            activeLens={activeLens}
            selectedInsightId={selectedInsightId}
            onSelectInsight={handleSelectInsight}
            onCorrect={setCorrectingInputId}
            onResetCorrection={handleResetCorrection}
          />

          {skills ? (
            <AiBenchmarkComparison
              benchmark={benchmark}
              benchmarkStatus={benchmarkStatus}
              benchmarkError={benchmarkError}
              skills={skills}
              onRunBenchmark={handleRunBenchmark}
            />
          ) : null}

          {skills && basisConflict ? (
            <ConflictResolutionPanel
              conflict={basisConflict}
              resolution={analystResolution}
              onResolve={setAnalystResolution}
              onShowEvidence={handleSelectInput}
              selectedInputId={selectedInputId}
            />
          ) : null}

          <SkillPanel
            skills={skills}
            onSelectInput={handleSelectInput}
            selectedInputId={selectedInputId}
          />
        </section>
      </main>

      {correctingInputId && analysis && effectiveInputs
        ? (() => {
            const effective = effectiveInputs.find(
              (i) => i.input_id === correctingInputId,
            );
            const original = analysis.inputs.find(
              (i) => i.input_id === correctingInputId,
            );
            if (!effective || !original) return null;
            return (
              <CorrectionDialog
                input={effective}
                original={original}
                existing={corrections[correctingInputId] ?? null}
                onSave={handleSaveCorrection}
                onReset={() => handleResetCorrection(correctingInputId)}
                onClose={() => setCorrectingInputId(null)}
              />
            );
          })()
        : null}

      {dialogOpen ? (
        <ApiKeyDialog
          configured={keyConfigured}
          onSave={(key) => {
            saveApiKey(key);
            setKeyConfigured(readApiKey() !== null);
            setDialogOpen(false);
            if (status === "error") {
              setStatus("idle");
              setErrorMessage(null);
            }
          }}
          onClear={() => {
            clearApiKey();
            setKeyConfigured(false);
            setDialogOpen(false);
          }}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
