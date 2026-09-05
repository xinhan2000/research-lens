import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * AY — app / eval isolation.
 *
 * The most important BUILD-9 boundary, verified by source scan rather than by
 * convention. Simple scans are appropriate here: the repository is small, and a
 * dependency-graph parser would be more machinery than the property needs.
 *
 * Three separate properties:
 *
 *   1. Ground Truth is unreachable from product runtime.
 *   2. Ground Truth is unreachable from the inference path, so an expected
 *      answer cannot influence a model request even by accident.
 *   3. No route or bundle exposes either.
 */

const ROOT = process.cwd();

const PRODUCT_DIRECTORIES = ["app", "components", "lib", "types"];

function sourceFiles(directory: string): string[] {
  const absolute = join(ROOT, directory);
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(entry)) out.push(path);
    }
  };
  walk(absolute);
  return out;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Source with comments removed.
 *
 * A prose mention of the dataset in a doc comment is not a runtime reference,
 * and several pre-existing product comments legitimately explain that Ground
 * Truth stays eval-only. Stripping comments keeps the scan pointed at code.
 *
 * Approximate by design — it does not model `//` inside string literals — which
 * is acceptable for a scan over a repository this size, and errs toward
 * removing more text rather than less.
 */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const isTestFile = (path: string) => /\.test\.tsx?$/.test(path);

describe("AY — app / eval boundary", () => {
  it("76. eval/inference.ts references no Ground Truth and no expected answers", () => {
    const source = code(join(ROOT, "eval", "inference.ts"));

    // Import graph: no scoring module, no Ground Truth loader.
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const specifier of imports) {
      expect(specifier, `inference imports ${specifier}`).not.toMatch(
        /ground-truth|scoring|safety|evaluate|behaviors|matching/,
      );
    }

    // Identifier scan: nothing that names an expected answer.
    for (const forbidden of [
      "Ground_Truth",
      "groundTruth",
      "expected_inputs",
      "expectedInputs",
      "expected_skills",
      "expectedSkills",
      "expectedAnswer",
    ]) {
      expect(source, `inference mentions ${forbidden}`).not.toContain(forbidden);
    }

    // The only inputs are a key, a document id, and report text.
    expect(source).toContain("apiKey");
    expect(source).toContain("documentId");
    expect(source).toContain("reportText");
  });

  it("77. no product file imports an eval module", () => {
    for (const directory of PRODUCT_DIRECTORIES) {
      for (const path of sourceFiles(directory)) {
        const source = read(path);
        const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
        for (const specifier of imports) {
          expect(
            specifier,
            `${relative(ROOT, path)} imports ${specifier}`,
          ).not.toMatch(/(^|\/)eval\//);
        }
      }
    }
  });

  it("78. no product runtime code references the Ground Truth dataset", () => {
    for (const directory of PRODUCT_DIRECTORIES) {
      for (const path of sourceFiles(directory)) {
        const source = code(path);
        expect(source, relative(ROOT, path)).not.toContain("Ground_Truth");
        expect(source, relative(ROOT, path)).not.toContain("ground-truth");
      }
    }
  });

  it("79. the Ground Truth path appears in exactly one module of runtime code", () => {
    const occurrences: string[] = [];
    for (const directory of [...PRODUCT_DIRECTORIES, "eval"]) {
      for (const path of sourceFiles(directory)) {
        if (isTestFile(path)) continue;
        if (code(path).includes("Ground_Truth.jsonl")) {
          occurrences.push(relative(ROOT, path));
        }
      }
    }
    expect(occurrences.sort()).toEqual(["eval/ground-truth.ts"]);
  });

  it("80. no API route exposes eval results or Ground Truth", () => {
    const routes = sourceFiles("app").filter((path) => path.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThan(0);
    for (const path of routes) {
      const source = read(path);
      for (const forbidden of [
        "Ground_Truth",
        "ground-truth",
        "eval/",
        "evalResult",
        "releaseStatus",
      ]) {
        expect(source, `${relative(ROOT, path)} mentions ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it("80b. no Next.js eval page or eval API route exists", () => {
    const appFiles = sourceFiles("app").map((path) => relative(ROOT, path));
    for (const path of appFiles) {
      expect(path.toLowerCase()).not.toMatch(/(^|\/)eval(\/|\.)/);
    }
  });
});

describe("BF — security scan of BUILD-9 code", () => {
  // Test files are excluded: they carry the forbidden strings as assertions.
  const evalFiles = sourceFiles("eval").filter((path) => !isTestFile(path));

  it("contains no API key literal and never prints the environment", () => {
    for (const path of evalFiles) {
      const source = read(path);
      expect(source, relative(ROOT, path)).not.toContain("sk-ant");
      expect(source, relative(ROOT, path)).not.toContain("console.log(process.env");
      expect(source, relative(ROOT, path)).not.toContain("JSON.stringify(process.env");
    }
  });

  it("reads ANTHROPIC_API_KEY in exactly one place and never logs its value", () => {
    const readers = evalFiles.filter((path) =>
      /process\.env\.ANTHROPIC_API_KEY/.test(read(path)),
    );
    expect(readers.map((path) => relative(ROOT, path))).toEqual(["eval/run.ts"]);

    const runSource = read(join(ROOT, "eval", "run.ts"));
    // The variable is named in the diagnostic; its value never is.
    expect(runSource).not.toMatch(/console\.(log|error)\([^)]*apiKey/);
    expect(runSource).not.toMatch(/process\.std(out|err)\.write\([^)]*apiKey/);
  });

  it("never stringifies an upstream error object", () => {
    for (const path of evalFiles) {
      const source = read(path);
      expect(source, relative(ROOT, path)).not.toMatch(/JSON\.stringify\(\s*error/);
      expect(source, relative(ROOT, path)).not.toMatch(/console\.\w+\(\s*error\s*\)/);
    }
  });
});
