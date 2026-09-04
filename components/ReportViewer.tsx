"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SampleReport } from "@/types/report";

/**
 * Center panel: the source-of-truth view of the selected report.
 *
 * `remark-gfm` is required so Report D's financial table renders as a table
 * rather than literal pipe characters.
 */
export default function ReportViewer({ report }: { report: SampleReport }) {
  return (
    <article className="report" aria-label={`${report.label} report`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
    </article>
  );
}
