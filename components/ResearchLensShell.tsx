"use client";

import { useState } from "react";

import InterpretationList from "@/components/InterpretationList";
import ReportViewer from "@/components/ReportViewer";
import type { AnalysisResponse } from "@/types/analytical-input";
import type { SampleReport } from "@/types/report";

/** Static for BUILD-1. Lens filtering arrives in BUILD-8. */
const LENSES = ["All", "Financials", "Risks", "Timeline", "Assumptions"];

export default function ResearchLensShell({
  reports,
  analysisByReportId,
}: {
  reports: SampleReport[];
  /** Validated interpretation per report. BUILD-2 supplies Report A only. */
  analysisByReportId: Record<string, AnalysisResponse>;
}) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];
  const analysis = analysisByReportId[selected.id] ?? null;

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
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" disabled title="Available in a later build step">
            Set Anthropic API Key
          </button>
          <span className="key-state">Not configured</span>

          <button
            type="button"
            className="primary"
            disabled
            title="Available in a later build step"
          >
            Analyze Report
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
            analysis is implemented.
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
          <InterpretationList analysis={analysis} />
        </section>
      </main>
    </div>
  );
}
