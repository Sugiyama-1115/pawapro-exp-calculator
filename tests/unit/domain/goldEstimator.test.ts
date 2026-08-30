import { beforeAll, describe, expect, it } from "vitest";
import { calculateGoldAbility } from "@/domain/calculator/goldCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import { estimateGoldCost } from "@/domain/estimator/goldEstimator";
import type { GoldAbilityRow, HintRule } from "@/domain/models/ability";
import type { GameDataSet } from "@/domain/models/gameData";
import { hintKey } from "@/domain/keys";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

const row = (hintLevel: number, cost: ReturnType<typeof v>): GoldAbilityRow => ({
  abilityId: "test_gold",
  displayName: "テスト金特",
  playerType: "fielder",
  hintLevel,
  senseMode: "sense_plus",
  cost,
});

const ruleMap = (entries: Array<[number, number]>): Map<string, HintRule> => {
  const map = new Map<string, HintRule>();
  for (const [hintLevel, multiplier] of entries) {
    map.set(hintKey("gold", hintLevel), {
      abilityType: "gold",
      hintLevel,
      multiplier,
      rounding: "floor",
    });
  }
  return map;
};

describe("estimateGoldCost", () => {
  it("UT-EST-01: 単一実測からの B 逆算（M=100, R=0.70 → B=143）", () => {
    const r = estimateGoldCost(
      [row(1, v(100, 0, 0, 0, 0))],
      3,
      ruleMap([
        [1, 0.7],
        [3, 0.4],
      ]),
      10000,
    );
    expect(r.baseValues.muscle).toBe(143);
  });

  it("UT-EST-02: 同点時は小さい B を採用（M=50, R=0.50 → B=100）", () => {
    const r = estimateGoldCost([row(2, v(50, 0, 0, 0, 0))], 2, ruleMap([[2, 0.5]]), 10000);
    expect(r.baseValues.muscle).toBe(100);
  });

  it("UT-EST-03 / UT-EST-08: 複数実測で誤差合計が最小の B をカテゴリ独立に採る", () => {
    const rules = ruleMap([
      [1, 0.7],
      [2, 0.5],
      [3, 0.4],
    ]);
    const r = estimateGoldCost(
      [row(1, v(100, 10, 50, 0, 20)), row(3, v(60, 6, 30, 0, 12))],
      2,
      rules,
      10000,
    );
    expect(r.baseValues).toEqual(v(143, 15, 72, 0, 29));
    expect(r.cost).toEqual(v(71, 7, 36, 0, 14));
    expect(r.baseValues.muscle).not.toBe(r.baseValues.mental);
  });

  it("UT-EST-04: 実測 0 のカテゴリは B=0 / cost=0", () => {
    const r = estimateGoldCost([row(1, v(0, 0, 0, 0, 0))], 3, ruleMap([
      [1, 0.7],
      [3, 0.4],
    ]), 10000);
    expect(r.baseValues).toEqual(v(0, 0, 0, 0, 0));
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
  });

  it("UT-EST-05: 実測 2 件以上は estimated_high", () => {
    const r = estimateGoldCost(
      [row(1, v(100, 0, 0, 0, 0)), row(3, v(60, 0, 0, 0, 0))],
      2,
      ruleMap([
        [1, 0.7],
        [2, 0.5],
        [3, 0.4],
      ]),
      10000,
    );
    expect(r.confidence).toBe("estimated_high");
  });

  it("UT-EST-06: 実測 1 件は estimated", () => {
    const r = estimateGoldCost(
      [row(1, v(100, 0, 0, 0, 0))],
      2,
      ruleMap([
        [1, 0.7],
        [2, 0.5],
      ]),
      10000,
    );
    expect(r.confidence).toBe("estimated");
  });

  it("UT-EST-07: 探索上限を超える B が必要でも例外を投げず上限内の最良 B を返す", () => {
    const rules = ruleMap([
      [1, 0.7],
      [3, 0.4],
    ]);
    expect(() => estimateGoldCost([row(1, v(100, 0, 0, 0, 0))], 3, rules, 10)).not.toThrow();
    const r = estimateGoldCost([row(1, v(100, 0, 0, 0, 0))], 3, rules, 10);
    expect(r.baseValues.muscle).toBe(10);
  });

  it("対象Lvの倍率が無い場合も例外を投げない", () => {
    const r = estimateGoldCost([row(1, v(100, 0, 0, 0, 0))], 4, ruleMap([[1, 0.7]]), 10000);
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
  });

  it("倍率が定義されていない実測行は逆算に使わない", () => {
    const r = estimateGoldCost(
      [row(1, v(100, 0, 0, 0, 0)), row(5, v(999, 0, 0, 0, 0))],
      3,
      ruleMap([
        [1, 0.7],
        [3, 0.4],
      ]),
      10000,
    );
    expect(r.baseValues.muscle).toBe(143);
  });

  it("UT-EST-09: 実測行が 0 件なら推定は呼ばれず GOLD_DATA_MISSING になる", () => {
    const r = calculateGoldAbility(gameData, "normal", {
      abilityId: "archartist",
      hintLevel: 1,
      lowerAbilityHintLevel: 0,
    });
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.GOLD_DATA_MISSING);
  });
});
