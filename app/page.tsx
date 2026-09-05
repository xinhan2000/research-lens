import ResearchLensShell from "@/components/ResearchLensShell";
import { assertEvidenceMatching } from "@/lib/evidence-match-cases";
import { assertInvalidFixturesRejected } from "@/lib/fixtures/invalid-analysis";
import { loadSampleReports } from "@/lib/reports";

export default function Page() {
  const reports = loadSampleReports();

  // Development-time proof that malformed structured output is rejected.
  // Throws at build time if the schema ever accepts an invalid fixture.
  // The fixture is NOT rendered — analysis comes only from live inference.
  const validationResults = assertInvalidFixturesRejected();

  // Deterministic evidence-matching assertions. Throws at build time on a
  // matching regression. No model call, no network.
  const evidenceResults = assertEvidenceMatching();

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[schema] ${validationResults.length}/${validationResults.length} invalid fixtures correctly rejected`,
    );
    console.log(
      `[evidence] ${evidenceResults.length}/${evidenceResults.length} matching cases passed`,
    );
  }

  return <ResearchLensShell reports={reports} />;
}
