import ResearchLensShell from "@/components/ResearchLensShell";
import { assertInvalidFixturesRejected } from "@/lib/fixtures/invalid-analysis";
import { loadSampleReports } from "@/lib/reports";

export default function Page() {
  const reports = loadSampleReports();

  // Development-time proof that malformed structured output is rejected.
  // Throws at build time if the schema ever accepts an invalid fixture.
  // The fixture is NOT rendered — analysis comes only from live inference.
  const validationResults = assertInvalidFixturesRejected();
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[schema] ${validationResults.length}/${validationResults.length} invalid fixtures correctly rejected`,
    );
  }

  return <ResearchLensShell reports={reports} />;
}
