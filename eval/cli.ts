import { GOLDEN_DOCUMENT_IDS, isGoldenDocumentId, type GoldenDocumentId } from "./report-map";

/**
 * Local argument parsing.
 *
 * Deliberately no CLI framework and no dependency: five flags do not justify
 * one, and a parser small enough to read in full is a parser whose behaviour
 * the tests can pin exactly.
 */

export type CliOptions = {
  /** Golden-set ids to evaluate. All four when the flag is absent. */
  reports: GoldenDocumentId[];
  /** Saved-output directory, or null for live inference. */
  fromDir: string | null;
  benchmark: boolean;
  /** Path for the machine-readable result JSON, or null. */
  output: string | null;
  help: boolean;
};

export type CliParse =
  | { ok: true; options: CliOptions }
  | { ok: false; error: string };

export const USAGE = `Research Lens eval

  npm run eval                             evaluate all four reports live
  npm run eval -- --report report_a_clean  evaluate one report live
  npm run eval -- --from-dir <dir>         score saved analyses, no API key
  npm run eval -- --benchmark              also run the AI-only benchmark
  npm run eval -- --output <file>          write machine-readable results

Live mode reads ANTHROPIC_API_KEY from the environment. The key is never
printed, never written to the result file, and never passed as an argument.

Saved-output mode expects files named:
  <dir>/report_a_clean.analysis.json
  <dir>/report_a_clean.benchmark.json   (optional, only with --benchmark)

Report ids: ${GOLDEN_DOCUMENT_IDS.join(", ")}`;

export function parseArgs(argv: readonly string[]): CliParse {
  const options: CliOptions = {
    reports: [...GOLDEN_DOCUMENT_IDS],
    fromDir: null,
    benchmark: false,
    output: null,
    help: false,
  };

  const selected: GoldenDocumentId[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--benchmark":
        options.benchmark = true;
        break;

      case "--report": {
        const value = argv[index + 1];
        index += 1;
        if (value === undefined || value.startsWith("--")) {
          return { ok: false, error: "--report requires a report id." };
        }
        if (!isGoldenDocumentId(value)) {
          return {
            ok: false,
            error: `Unknown report id "${value}". Expected one of: ${GOLDEN_DOCUMENT_IDS.join(", ")}.`,
          };
        }
        if (!selected.includes(value)) selected.push(value);
        break;
      }

      case "--from-dir": {
        const value = argv[index + 1];
        index += 1;
        if (value === undefined || value.startsWith("--")) {
          return { ok: false, error: "--from-dir requires a directory path." };
        }
        options.fromDir = value;
        break;
      }

      case "--output": {
        const value = argv[index + 1];
        index += 1;
        if (value === undefined || value.startsWith("--")) {
          return { ok: false, error: "--output requires a file path." };
        }
        options.output = value;
        break;
      }

      default:
        return { ok: false, error: `Unrecognised argument "${arg}".` };
    }
  }

  if (selected.length > 0) options.reports = selected;

  return { ok: true, options };
}
