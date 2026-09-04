import { safeParseAnalysisResponse } from "@/lib/analysis";
import { reportAAnalysis } from "@/lib/fixtures/report-a-analysis";

/**
 * Deliberately malformed fixtures proving the schema rejects unsafe structured
 * output rather than coercing it.
 *
 * A dedicated test runner arrives in BUILD-5. Until then these assertions run
 * during server render, so `npm run build` fails if any invalid case is ever
 * accepted.
 */

/** Deep clone of the valid fixture, so each case differs by exactly one defect. */
function validClone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(reportAAnalysis));
}

function mutateFirstInput(
  change: (input: Record<string, unknown>) => void,
): unknown {
  const response = validClone();
  const inputs = response.inputs as Record<string, unknown>[];
  change(inputs[0]);
  return response;
}

export const INVALID_FIXTURES: { name: string; data: unknown }[] = [
  {
    name: "unknown enum value for temporal_type",
    data: mutateFirstInput((input) => {
      input.temporal_type = "probably_actual";
    }),
  },
  {
    name: "missing required field (basis)",
    data: mutateFirstInput((input) => {
      delete input.basis;
    }),
  },
  {
    name: 'precision "range" without range bounds',
    data: mutateFirstInput((input) => {
      input.precision = "range";
      input.range = null;
    }),
  },
  {
    name: "unknown key smuggled into an input",
    data: mutateFirstInput((input) => {
      input.estimated_multiple = 34.9;
    }),
  },
  {
    name: "value provided as a formatted string instead of a number",
    data: mutateFirstInput((input) => {
      input.value = "$82.0M";
    }),
  },
  {
    name: "evidence_type none marked as resolved",
    data: mutateFirstInput((input) => {
      input.evidence_type = "none";
      input.resolved = true;
    }),
  },
];

export type InvalidFixtureResult = {
  name: string;
  rejected: boolean;
  firstIssue: string;
};

/**
 * Runs every invalid fixture through the schema.
 *
 * Throws if any malformed response is accepted — silent acceptance is the
 * failure mode this build step exists to prevent.
 */
export function assertInvalidFixturesRejected(): InvalidFixtureResult[] {
  const results = INVALID_FIXTURES.map(({ name, data }) => {
    const parsed = safeParseAnalysisResponse(data);
    const issue = parsed.success ? null : parsed.error.issues[0];

    return {
      name,
      rejected: !parsed.success,
      firstIssue: issue
        ? `${issue.path.join(".") || "(root)"}: ${issue.message}`
        : "ACCEPTED — schema failed to reject this fixture",
    };
  });

  const accepted = results.filter((result) => !result.rejected);
  if (accepted.length > 0) {
    throw new Error(
      `Schema accepted ${accepted.length} invalid fixture(s): ${accepted
        .map((result) => result.name)
        .join("; ")}`,
    );
  }

  return results;
}
