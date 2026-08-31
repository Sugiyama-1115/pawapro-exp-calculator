/**
 * UT-IMP: プランJSONの読み込み（06_persistence_spec.md §5.2 / UI-PL-09・10）。
 */
import { describe, expect, it } from "vitest";
import { buildPlanJson } from "@/data/persistence/exporter";
import {
  parsePlanJson,
  PLAN_IMPORT_BROKEN_PLAN,
  PLAN_IMPORT_NOT_JSON,
  PLAN_IMPORT_UNSUPPORTED_VERSION,
  PLAN_IMPORT_WRONG_FORMAT,
} from "@/data/persistence/planImporter";
import type { PlayerPlan } from "@/domain/models/plan";

const PLAN: PlayerPlan = {
  id: "plan-1",
  name: "エース候補A",
  gameId: "sample2024",
  playerType: "pitcher",
  senseMode: "sense_plus",
  currentBase: { velocity: 130 },
  targetBase: { velocity: 133 },
  blueTargets: [
    { abilityId: "strikeout", currentState: "NONE", targetState: "ON", hintLevel: 3 },
  ],
  goldTargets: [{ abilityId: "doctor_k", hintLevel: 2, lowerAbilityHintLevel: 1 }],
  breakingPlan: {
    composition: [{ pitchType: "slider", level: 2 }],
    mode: "step",
    aggregate: null,
    steps: [
      {
        seq: 1,
        pitchType: "slider",
        fromLevel: 1,
        toLevel: 2,
        totalBreakBefore: 1,
        pitchCountBefore: 1,
        cost: { muscle: 0, agility: 0, technique: 10, breaking: 50, mental: 0 },
      },
    ],
  },
  createdAt: "2026-08-30T05:00:00.000Z",
  updatedAt: "2026-08-30T05:22:00.000Z",
};

describe("parsePlanJson", () => {
  it("UT-IMP-01: 自身が出力したプランJSONを同一内容で読み戻せる", () => {
    const result = parsePlanJson(buildPlanJson(PLAN, new Date("2026-08-31T00:00:00.000Z")));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan).toEqual(PLAN);
  });

  it("UT-IMP-02: JSONとして壊れているファイルは拒否する", () => {
    expect(parsePlanJson("{")).toEqual({ ok: false, message: PLAN_IMPORT_NOT_JSON });
  });

  it("UT-IMP-03: 本アプリ以外のJSONは format 不一致として拒否する", () => {
    expect(parsePlanJson(JSON.stringify({ hello: "world" }))).toEqual({
      ok: false,
      message: PLAN_IMPORT_WRONG_FORMAT,
    });
  });

  it("UT-IMP-04: 対応外の formatVersion は拒否する", () => {
    const text = JSON.stringify({
      format: "pawapro-exp-calculator/plan",
      formatVersion: 99,
      exportedAt: "2026-08-31T00:00:00.000Z",
      plan: PLAN,
    });

    expect(parsePlanJson(text)).toEqual({
      ok: false,
      message: PLAN_IMPORT_UNSUPPORTED_VERSION,
    });
  });

  it("UT-IMP-05: plan の必須項目が欠けている場合は採用しない", () => {
    const broken = { ...PLAN, playerType: "unknown" };
    const text = JSON.stringify({
      format: "pawapro-exp-calculator/plan",
      formatVersion: 1,
      exportedAt: "2026-08-31T00:00:00.000Z",
      plan: broken,
    });

    expect(parsePlanJson(text)).toEqual({ ok: false, message: PLAN_IMPORT_BROKEN_PLAN });
  });

  it("UT-IMP-06: 変化球ステップの経験点が壊れている場合は採用しない", () => {
    const broken = {
      ...PLAN,
      breakingPlan: {
        composition: [],
        mode: "step",
        aggregate: null,
        steps: [
          {
            seq: 1,
            pitchType: "slider",
            fromLevel: 1,
            toLevel: 2,
            totalBreakBefore: 1,
            pitchCountBefore: 1,
            cost: { muscle: 0 },
          },
        ],
      },
    };
    const text = JSON.stringify({
      format: "pawapro-exp-calculator/plan",
      formatVersion: 1,
      exportedAt: "2026-08-31T00:00:00.000Z",
      plan: broken,
    });

    expect(parsePlanJson(text)).toEqual({ ok: false, message: PLAN_IMPORT_BROKEN_PLAN });
  });

  it("UT-IMP-07: breakingPlan が null のプランも読み込める", () => {
    const text = buildPlanJson({ ...PLAN, breakingPlan: null }, new Date());
    const result = parsePlanJson(text);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.breakingPlan).toBeNull();
  });
});
