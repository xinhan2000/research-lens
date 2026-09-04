import ResearchLensShell from "@/components/ResearchLensShell";
import { assertInvalidFixturesRejected } from "@/lib/fixtures/invalid-analysis";
import { reportAAnalysis } from "@/lib/fixtures/report-a-analysis";
import { loadSampleReports } from "@/lib/reports";
import type { AnalysisResponse } from "@/types/analytical-input";

/**
 * BUILD-2 fixture wiring. Report A only; the other three reports show an
 * explicit "not available yet" message rather than invented data.
 */
const ANALYSIS_BY_REPORT_ID: Record<string, AnalysisResponse> = {
  clean: reportAAnalysis,
};

export default function Page() {
  const reports = loadSampleReports();

  // Proves malformed structured output is rejected. Throws at build time if the
  // schema ever accepts an invalid fixture. Replaced by real tests in BUILD-5.
  const validationResults = assertInvalidFixturesRejected();
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[schema] ${validationResults.length}/${validationResults.length} invalid fixtures correctly rejected:\n` +
        validationResults
          .map((result) => `  - ${result.name} -> ${result.firstIssue}`)
          .join("\n"),
    );
  }

  return (
    <ResearchLensShell
      reports={reports}
      analysisByReportId={ANALYSIS_BY_REPORT_ID}
    />
  );
}
