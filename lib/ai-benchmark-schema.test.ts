import { describe, expect, it } from "vitest";

import {
  AI_BENCHMARK_TASK_IDS,
  aiBenchmarkResponseSchema,
  buildBenchmarkRequestBody,
  normalizeBenchmarkOrder,
  parseBenchmarkResponse,
  type AiBenchmarkTaskId,
} from "./ai-benchmark-schema";
import {
  BENCHMARK_SKILL_IDS,
  BENCHMARK_TASK_TO_SKILL_ID,
  skillIdForTask,
} from "./benchmark-skill-map";
import {
  AI_BENCHMARK_SYSTEM_PROMPT,
  buildBenchmarkUserMessage,
} from "./prompts/ai-benchmark-prompt";
import { AI_BENCHMARK_JSON_SCHEMA } from "./ai-benchmark-json-schema";
import { runSkills } from "./skills/engine";
import { reportAInputs } from "./skills/fixtures";

function item(taskId: string, answer: string | null = "23.2%") {
  return { task_id: taskId, answer, explanation: "Used FY2024 and FY2025." };
}

function validResponse() {
  return { items: AI_BENCHMARK_TASK_IDS.map((id) => item(id)) };
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

describe("benchmark schema", () => {
  it("accepts a valid six-item response", () => {
    expect(aiBenchmarkResponseSchema.safeParse(validResponse()).success).toBe(true);
  });

  it("rejects a missing item", () => {
    const r = validResponse();
    r.items.pop();
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
    expect(() => parseBenchmarkResponse(r)).toThrow(/missing|exactly 6/i);
  });

  it("rejects a duplicate task id", () => {
    const r = validResponse();
    r.items[5] = item("revenue_growth");
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
    expect(() => parseBenchmarkResponse(r)).toThrow(/duplicate/i);
  });

  it("rejects an unknown task id", () => {
    const r = validResponse();
    r.items[0] = item("cagr");
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
  });

  it("rejects more than six items", () => {
    const r = validResponse();
    r.items.push(item("revenue_growth"));
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
  });

  it("allows a null answer", () => {
    const r = validResponse();
    r.items[3] = item("net_debt", null);
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(true);
  });

  it("rejects a malformed item", () => {
    const r = validResponse() as { items: unknown[] };
    r.items[2] = { task_id: "ebitda_margin", answer: 18.4, explanation: "x" };
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
  });

  it("rejects prohibited trust/skill fields smuggled onto an item", () => {
    for (const extra of [
      { status: "READY" },
      { trust_state: "auto" },
      { conflict_state: "none" },
      { resolved: true },
      { inputIds: ["a"] },
      { evidenceLineage: true },
      { materiality: "high" },
    ]) {
      const r = validResponse() as { items: Record<string, unknown>[] };
      r.items[0] = { ...r.items[0], ...extra };
      expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
    }
  });

  it("rejects an unknown top-level key", () => {
    const r = { ...validResponse(), skills: [] };
    expect(aiBenchmarkResponseSchema.safeParse(r).success).toBe(false);
  });

  it("never returns partial items from an invalid response", () => {
    const r = validResponse();
    r.items.splice(4, 2);
    let threw = false;
    try {
      parseBenchmarkResponse(r);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Canonical catalog and mapping
 * ------------------------------------------------------------------ */

describe("catalog and skill mapping", () => {
  it("has exactly six task ids with no duplicates", () => {
    expect(AI_BENCHMARK_TASK_IDS).toHaveLength(6);
    expect(new Set(AI_BENCHMARK_TASK_IDS).size).toBe(6);
  });

  it("does not include CAGR or any extra task", () => {
    expect(AI_BENCHMARK_TASK_IDS).toEqual([
      "revenue_growth",
      "gross_margin",
      "ebitda_margin",
      "net_debt",
      "ev_revenue",
      "ev_ebitda",
    ]);
  });

  it("maps all six tasks to six unique skill ids", () => {
    const skillIds = Object.values(BENCHMARK_TASK_TO_SKILL_ID);
    expect(skillIds).toHaveLength(6);
    expect(new Set(skillIds).size).toBe(6);
    for (const taskId of AI_BENCHMARK_TASK_IDS) {
      expect(BENCHMARK_TASK_TO_SKILL_ID[taskId]).toMatch(/^skill_/);
    }
  });

  it("maps onto skill ids the engine actually produces", () => {
    const engineIds = runSkills(reportAInputs()).map((s) => s.skillId).sort();
    expect([...BENCHMARK_SKILL_IDS].sort()).toEqual(engineIds);
  });

  it("returns null for an unknown task id", () => {
    expect(skillIdForTask("cagr")).toBeNull();
    expect(skillIdForTask("skill_revenue_growth")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Request payload boundary
 * ------------------------------------------------------------------ */

describe("benchmark request payload", () => {
  const body = buildBenchmarkRequestBody("fake-key-for-tests", "Report text.");

  it("contains only apiKey and reportText", () => {
    expect(Object.keys(body).sort()).toEqual(["apiKey", "reportText"]);
  });

  it("carries no Research Lens or Ground Truth data", () => {
    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of [
      "analysis",
      "inputs",
      "skills",
      "skillresult",
      "analyticalinput",
      "trust_state",
      "conflict_state",
      "ground_truth",
      "groundtruth",
      "expected",
      "selectedinputid",
      "documentid",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Prompt neutrality
 * ------------------------------------------------------------------ */

describe("benchmark prompt", () => {
  const prompt = AI_BENCHMARK_SYSTEM_PROMPT;

  it("names all six analytical tasks", () => {
    for (const name of [
      "Revenue Growth",
      "Gross Margin",
      "EBITDA Margin",
      "Net Debt",
      "EV / Revenue",
      "EV / EBITDA",
    ]) {
      expect(prompt).toContain(name);
    }
  });

  it("lists all six canonical task identifiers exactly once", () => {
    for (const id of AI_BENCHMARK_TASK_IDS) {
      expect(prompt.split(id).length - 1).toBe(1);
    }
  });

  it("asks for all six tasks exactly once", () => {
    expect(prompt).toMatch(/all six tasks exactly once/i);
  });

  it("leaks no Research Lens trust vocabulary", () => {
    for (const term of [
      "READY",
      "NEEDS_REVIEW",
      "BLOCKED",
      "AUTO",
      "ASK",
      "ABSTAIN",
      "AnalyticalInput",
      "SkillResult",
      "Research Lens",
      "trust_state",
      "conflict_state",
      "Ground Truth",
    ]) {
      expect(prompt).not.toContain(term);
    }
  });

  it("expresses no period or basis preference and no aggressiveness steer", () => {
    for (const phrase of [
      "prefer adjusted",
      "prefer reported",
      "choose adjusted",
      "choose reported",
      "use the latest",
      "be conservative",
      "be aggressive",
      "always refuse",
      "always calculate",
    ]) {
      expect(prompt.toLowerCase()).not.toContain(phrase);
    }
  });

  it("sends only the report in the user message", () => {
    const message = buildBenchmarkUserMessage("REPORT BODY");
    expect(message).toContain("REPORT BODY");
    expect(message.toLowerCase()).not.toContain("skill");
    expect(message.toLowerCase()).not.toContain("expected");
  });
});

/* ------------------------------------------------------------------ *
 * JSON schema
 * ------------------------------------------------------------------ */

describe("benchmark JSON schema", () => {
  it("enumerates exactly the canonical task ids", () => {
    const items = (AI_BENCHMARK_JSON_SCHEMA.properties as Record<string, any>)
      .items.items;
    expect(items.properties.task_id.enum).toEqual([...AI_BENCHMARK_TASK_IDS]);
  });

  it("allows a null answer via anyOf rather than a type array", () => {
    const items = (AI_BENCHMARK_JSON_SCHEMA.properties as Record<string, any>)
      .items.items;
    expect(items.properties.answer.anyOf).toEqual([
      { type: "string" },
      { type: "null" },
    ]);
    expect(Array.isArray(items.properties.answer.type)).toBe(false);
  });

  it("closes objects and carries no skill or trust fields", () => {
    const serialized = JSON.stringify(AI_BENCHMARK_JSON_SCHEMA);
    expect(serialized).toContain('"additionalProperties":false');
    for (const forbidden of ["READY", "trust_state", "conflict_state", "resolved"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Response handling and skill isolation
 * ------------------------------------------------------------------ */

describe("response handling and skill isolation", () => {
  it("normalizes validated items into canonical task order", () => {
    const shuffled = {
      items: [...AI_BENCHMARK_TASK_IDS].reverse().map((id) => item(id)),
    };
    const parsed = parseBenchmarkResponse(shuffled);
    expect(parsed.items.map((i) => i.task_id)).toEqual([...AI_BENCHMARK_TASK_IDS]);
  });

  it("normalization does not alter item content", () => {
    const parsed = normalizeBenchmarkOrder(validResponse() as never);
    expect(parsed.items).toHaveLength(6);
    expect(parsed.items.every((i) => i.explanation.length > 0)).toBe(true);
  });

  it("pairing a benchmark to skills does not mutate any SkillResult", () => {
    const skills = runSkills(reportAInputs());
    const before = JSON.stringify(skills);
    const benchmark = parseBenchmarkResponse(validResponse());
    for (const taskId of AI_BENCHMARK_TASK_IDS as readonly AiBenchmarkTaskId[]) {
      const paired = skills.find(
        (s) => s.skillId === BENCHMARK_TASK_TO_SKILL_ID[taskId],
      );
      expect(paired).toBeDefined();
      benchmark.items.find((i) => i.task_id === taskId);
    }
    expect(JSON.stringify(skills)).toBe(before);
  });

  it("skill results are identical whether or not a benchmark exists", () => {
    const withoutBenchmark = JSON.stringify(runSkills(reportAInputs()));
    parseBenchmarkResponse(validResponse());
    const withBenchmark = JSON.stringify(runSkills(reportAInputs()));
    expect(withBenchmark).toBe(withoutBenchmark);
  });
});
