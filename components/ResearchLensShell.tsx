"use client";

import { useCallback, useEffect, useState } from "react";

import ApiKeyDialog from "@/components/ApiKeyDialog";
import InterpretationList from "@/components/InterpretationList";
import ReportViewer from "@/components/ReportViewer";
import { clearApiKey, readApiKey, saveApiKey } from "@/lib/api-key";
import type { AnalysisResponse } from "@/types/analytical-input";
import type { SampleReport } from "@/types/report";

/** Static for BUILD-3. Lens filtering arrives in BUILD-8. */
const LENSES = ["All", "Financials", "Risks", "Timeline", "Assumptions"];

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

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];

  // sessionStorage is unavailable during server render.
  useEffect(() => {
    setKeyConfigured(readApiKey() !== null);
  }, []);

  /** Switching reports must never leave another report's analysis on screen. */
  function handleSelectReport(id: string) {
    setSelectedId(id);
    setAnalysis(null);
    setStatus("idle");
    setErrorMessage(null);
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

  const analyzing = status === "analyzing";

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
              disabled={analyzing}
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
            disabled={analyzing}
          >
            {analyzing ? "Analyzing…" : "Analyze Report"}
          </button>
        </div>
      </header>

      <nav className="lens-row" aria-label="Analytical lenses">
        {LENSES.map((lens, index) => (
          <span
            key={lens}
            className={`lens${index === 0 ? " lens-active" : ""}`}
            aria-disabled="true"
          >
            {lens}
          </span>
        ))}
        <span className="lens-note">Filtering not implemented yet</span>
      </nav>

      <main className="panels">
        <section className="panel panel-nav" aria-label="Semantic navigation">
          <h2 className="panel-title">Semantic Navigation</h2>
          <p className="placeholder">
            AI-generated analytical organization of the report appears here once
            navigation is implemented.
          </p>
        </section>

        <section className="panel panel-report" aria-label="Original report">
          <h2 className="panel-title">
            Original Report
            <span className="panel-meta">{selected.fileName}</span>
          </h2>
          <ReportViewer report={selected} />
        </section>

        <section className="panel panel-analysis" aria-label="Analysis and skills">
          <h2 className="panel-title">Analysis / Skills</h2>
          <InterpretationList
            analysis={analysis}
            status={status}
            errorMessage={errorMessage}
            onRetry={handleAnalyze}
          />
        </section>
      </main>

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
