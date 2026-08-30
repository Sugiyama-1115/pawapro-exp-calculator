import { beforeAll, describe, expect, it } from "vitest";
import { calculateBreaking } from "@/domain/calculator/breakingCalculator";
import { calculatePlan } from "@/domain/calculator/planCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { ExpVector } from "@/domain/models/expVector";
import type { GameDataSet } from "@/domain/models/gameData";
import type { BreakingPlan, BreakingStep, PlayerPlan } from "@/domain/models/plan";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

const step = (
  seq: number,
  pitchType: string,
  fromLevel: number,
  totalBreakBefore: number,
  pitchCountBefore: number,
  cost: ExpVector | null = null,
): BreakingStep => ({
  seq,
  pitchType,
  fromLevel,
  toLevel: fromLevel + 1,
  totalBreakBefore,
  pitchCountBefore,
  cost,
});

const breakingPlan = (override: Partial<BreakingPlan>): BreakingPlan => ({
  composition: [{ pitchType: "slider", level: 2 }],
  mode: "step",
  aggregate: null,
  steps: [],
  ...override,
});

const pitcherPlan = (plan: BreakingPlan | null): PlayerPlan => ({
  id: "test",
  name: "テスト",
  gameId: "sample2024",
  playerType: "pitcher",
  senseMode: "sense_plus",
  currentBase: {},
  targetBase: {},
  blueTargets: [],
  goldTargets: [],
  breakingPlan: plan,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
});

describe("calculateBreaking", () => {
  it("UT-BR-01: aggregate はステップを参照せず一括値のみを使う", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({
        mode: "aggregate",
        aggregate: v(1, 2, 3, 4, 5),
        steps: [step(1, "slider", 1, 1, 1)],
      }),
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.cost).toEqual(v(1, 2, 3, 4, 5));
    expect(r.items[0]?.source).toBe("manual");
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BR-02: step 未入力はキャッシュ完全一致で解決する", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ steps: [step(1, "slider", 1, 1, 1)] }),
    );
    expect(r.items[0]?.cost).toEqual(v(0, 0, 10, 50, 0));
    expect(r.items[0]?.source).toBe("measured");
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BR-03: キャッシュ未ヒットは BREAKING_DATA_MISSING（0 計上しない）", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ steps: [step(1, "slider", 1, 9, 1)] }),
    );
    expect(r.items).toHaveLength(0);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("UT-BR-04: 目標構成が空なら items 空 / issue なし", () => {
    const r = calculateBreaking(gameData, "sense_plus", null);
    expect(r.items).toHaveLength(0);
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BR-05: 目標構成があり経験点が未入力なら BREAKING_DATA_MISSING", () => {
    const r = calculateBreaking(gameData, "sense_plus", breakingPlan({ mode: "none" }));
    expect(r.items).toHaveLength(0);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("mode=none で目標構成が空なら issue なし", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ mode: "none", composition: [] }),
    );
    expect(r.items).toHaveLength(0);
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BR-06: 野手プランでは変化球を計算しない", () => {
    const plan: PlayerPlan = {
      ...pitcherPlan(breakingPlan({ steps: [step(1, "slider", 1, 9, 1)] })),
      playerType: "fielder",
    };
    const result = calculatePlan(gameData, plan);
    expect(result.breaking).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it("UT-BR-07: normal は breaking_cache_normal.csv を使用する", () => {
    const r = calculateBreaking(
      gameData,
      "normal",
      breakingPlan({ steps: [step(1, "slider", 1, 1, 1)] }),
    );
    expect(r.items[0]?.cost).toEqual(v(0, 0, 20, 100, 0));
  });

  it("UT-BR-08: 入力済みの step.cost はキャッシュより優先する", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ steps: [step(1, "slider", 1, 1, 1, v(9, 9, 9, 9, 9))] }),
    );
    expect(r.items[0]?.cost).toEqual(v(9, 9, 9, 9, 9));
    expect(r.items[0]?.source).toBe("manual");
  });

  it("UT-BR-09: 近傍キーにデータがあってもヒットさせない", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ steps: [step(1, "slider", 1, 2, 1)] }),
    );
    expect(r.items).toHaveLength(0);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("UT-BR-10: 一括値の一部が未入力なら BREAKING_DATA_MISSING", () => {
    const partial = { muscle: 1, agility: 2, technique: 3, breaking: null, mental: 5 };
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ mode: "aggregate", aggregate: partial as unknown as ExpVector }),
    );
    expect(r.items).toHaveLength(0);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("aggregate が null なら BREAKING_DATA_MISSING", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ mode: "aggregate", aggregate: null }),
    );
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("mode=step でステップ未作成なら BREAKING_DATA_MISSING", () => {
    const r = calculateBreaking(gameData, "sense_plus", breakingPlan({ steps: [] }));
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BREAKING_DATA_MISSING);
  });

  it("ステップは seq 昇順で出力される", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ steps: [step(2, "slider", 2, 2, 1), step(1, "slider", 1, 1, 1)] }),
    );
    expect(r.items.map((i) => i.id)).toEqual(["step-1", "step-2"]);
  });

  it("aggregate の detail に目標構成が入る", () => {
    const r = calculateBreaking(
      gameData,
      "sense_plus",
      breakingPlan({ mode: "aggregate", aggregate: v(1, 1, 1, 1, 1), composition: [] }),
    );
    expect(r.items[0]?.detail).toBe("一括入力");
  });
});
