import ResearchLensShell from "@/components/ResearchLensShell";
import { loadSampleReports } from "@/lib/reports";

export default function Page() {
  const reports = loadSampleReports();

  return <ResearchLensShell reports={reports} />;
}
