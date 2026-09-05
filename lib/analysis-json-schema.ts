import { z } from "zod";

import { analysisResponseSchema } from "./analysis-schema";

/**
 * JSON Schema handed to Anthropic structured outputs.
 *
 * Generated FROM the Zod schema so `lib/analysis-schema.ts` stays the single
 * source of truth — no hand-maintained duplicate, no `zod-to-json-schema`
 * dependency.
 *
 * Three conversion facts drive the code below:
 *
 * 1. Zod `.refine()` rules cannot be represented in JSON Schema and are
 *    dropped. Model-side enforcement is therefore strictly weaker than our
 *    contract, which is why every response is still parsed through
 *    `parseAnalysisResponse` in `lib/analysis.ts`.
 * 2. Zod emits nullable fields as `{"type": ["string", "null"]}`. The
 *    documented structured-outputs subset uses `anyOf` for this, so type
 *    arrays are rewritten below.
 * 3. Constraints such as `minLength` and `minimum` are not part of the
 *    supported subset and are stripped. They remain enforced by Zod after the
 *    response arrives.
 *
 * The SDK's own `zodOutputFormat` transform is deliberately not used: it
 * demotes `enum` into a free-text description, which would turn our semantic
 * enums (temporal_type, basis, trust_state, conflict_state) into hints rather
 * than constraints. `enum` is part of the supported subset, so it is kept.
 */

type JsonObject = Record<string, unknown>;

/** Constraint keywords outside the supported structured-outputs subset. */
const UNSUPPORTED_KEYWORDS = new Set([
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "maxItems",
  "uniqueItems",
]);

function normalize(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(normalize);
  }

  if (node === null || typeof node !== "object") {
    return node;
  }

  const result: JsonObject = {};

  for (const [key, value] of Object.entries(node as JsonObject)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;

    // `minItems` is supported only for the values 0 and 1.
    if (key === "minItems") {
      if (value === 0 || value === 1) result[key] = value;
      continue;
    }

    // `type` and `enum` hold keywords/literals, not nested schemas.
    result[key] = key === "type" || key === "enum" ? value : normalize(value);
  }

  // `{"type": ["string", "null"]}` -> `{"anyOf": [...]}`.
  const type = result.type;
  if (Array.isArray(type)) {
    delete result.type;
    result.anyOf = type.map((entry) => ({ type: entry }));
  }

  // Objects must be closed.
  if (result.type === "object") {
    result.additionalProperties = false;
  }

  return result;
}

/** The schema sent as `output_config.format.schema`. */
export const ANALYSIS_RESPONSE_JSON_SCHEMA = normalize(
  z.toJSONSchema(analysisResponseSchema, { reused: "inline" }),
) as JsonObject;
