import { beforeAll, describe, expect, it } from "vitest";
import { calculatePlan } from "@/domain/calculator/planCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import { addVector, sumVectors } from "@/domain/models/expVector";
import type { GameDataSet } from "@/domain/models/gameData";
import type { PlayerPlan } from "@/domain/models/plan";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

const plan = (override: Partial<PlayerPlan>): PlayerPlan => ({
  id: "plan-1",
  name: "テスト選手",
  gameId: "sample2024",
  playerType: "fielder",
  senseMode: "sense_plus",
  currentBase: {},
  targetBase: {},
  blueTargets: [],
  goldTargets: [],
  breakingPlan: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...override,
});

describe("calculatePlan", () => {
  it("UT-PLAN-01: 金特の下位青特が autoAdded で追加される", () => {
    const result = calculatePlan(
      gameData,
      plan({ goldTargets: [{ abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 0 }] }),
    );
    expect(result.blue).toHaveLength(1);
    expect(result.blue[0]?.id).toBe("power_hitter");
    expect(result.blue[0]?.autoAdded).toBe(true);
  });

  it("UT-PLAN-02: 所持済み申告があれば下位青特の cost は 0", () => {
    const result = calculatePlan(
      gameData,
      plan({
        blueTargets: [
          { abilityId: "power_hitter", currentState: "ON", targetState: "ON", hintLevel: 0 },
        ],
        goldTargets: [{ abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 0 }],
      }),
    );
    expect(result.blue).toHaveLength(1);
    expect(result.blue[0]?.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(result.gold[0]?.cost).toEqual(v(100, 10, 50, 0, 20));
  });

  it("UT-PLAN-03: ユーザー指定のコツLvを優先し二重計上しない", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "normal",
        blueTargets: [
          { abilityId: "power_hitter", currentState: "NONE", targetState: "ON", hintLevel: 4 },
        ],
        goldTargets: [{ abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 2 }],
      }),
    );
    expect(result.blue).toHaveLength(1);
    expect(result.blue[0]?.cost).toEqual(v(72, 4, 20, 0, 2));
    expect(result.blue[0]?.autoAdded).toBe(false);
  });

  it("UT-PLAN-04: 前提ランクまで自動的に引き上げられる（chance D→A）", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "normal",
        blueTargets: [
          { abilityId: "chance", currentState: "D", targetState: "D", hintLevel: 0 },
        ],
        goldTargets: [
          { abilityId: "clutch_master", hintLevel: 0, lowerAbilityHintLevel: 0 },
        ],
      }),
    );
    expect(result.blue).toHaveLength(1);
    expect(result.blue[0]?.detail).toBe("D → A / コツLv0");
    expect(result.blue[0]?.cost).toEqual(v(0, 60, 105, 0, 375));
  });

  it("青特に未指定の下位ランク能力は G から積み上げる", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "normal",
        goldTargets: [{ abilityId: "clutch_master", hintLevel: 0, lowerAbilityHintLevel: 0 }],
      }),
    );
    expect(result.blue[0]?.detail).toBe("G → A / コツLv0");
    expect(result.blue[0]?.cost).toEqual(v(0, 91, 159, 0, 567));
  });

  it("UT-PLAN-05: 前提を持たない金特は青特を自動追加しない", () => {
    const result = calculatePlan(
      gameData,
      plan({ goldTargets: [{ abilityId: "laser_beam", hintLevel: 1, lowerAbilityHintLevel: 0 }] }),
    );
    expect(result.blue).toHaveLength(0);
    expect(result.gold).toHaveLength(1);
  });

  it("UT-PLAN-06: 複数の金特が同じ下位青特を要求しても1件のみ計上", () => {
    const result = calculatePlan(
      gameData,
      plan({
        goldTargets: [
          { abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 0 },
          { abilityId: "archartist", hintLevel: 3, lowerAbilityHintLevel: 2 },
        ],
      }),
    );
    expect(result.blue).toHaveLength(1);
    // ユーザー指定が無い場合は自動追加分のうち最大のコツLv（＝最も安い）を採る
    expect(result.blue[0]?.detail).toBe("NONE → ON / コツLv2");
  });

  it("UT-PLAN-07: total は各カテゴリ小計の総和と一致する", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "sense_plus",
        currentBase: { contact: 40 },
        targetBase: { contact: 42 },
        blueTargets: [
          { abilityId: "chance", currentState: "G", targetState: "D", hintLevel: 0 },
        ],
        goldTargets: [{ abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 0 }],
      }),
    );
    const expected = sumVectors([
      result.subtotal.base,
      result.subtotal.blue,
      result.subtotal.gold,
      result.subtotal.breaking,
    ]);
    expect(result.total).toEqual(expected);
    expect(result.subtotal.base).toEqual(v(2, 0, 10, 0, 14));
  });

  it("UT-PLAN-08: 全項目が確定値なら confirmed", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "sense_plus",
        currentBase: { contact: 40 },
        targetBase: { contact: 41 },
        blueTargets: [
          { abilityId: "power_hitter", currentState: "NONE", targetState: "ON", hintLevel: 0 },
        ],
      }),
    );
    expect(result.issues).toHaveLength(0);
    expect(result.status).toBe("confirmed");
  });

  it("UT-PLAN-09: 推定を含めば estimated", () => {
    const result = calculatePlan(
      gameData,
      plan({ goldTargets: [{ abilityId: "archartist", hintLevel: 2, lowerAbilityHintLevel: 0 }] }),
    );
    expect(result.gold[0]?.source).toBe("estimated_high");
    expect(result.status).toBe("estimated");
  });

  it("UT-PLAN-10: データ不足があれば incomplete が優先される", () => {
    const result = calculatePlan(
      gameData,
      plan({
        goldTargets: [
          { abilityId: "archartist", hintLevel: 2, lowerAbilityHintLevel: 0 },
          { abilityId: "unknown_gold", hintLevel: 1, lowerAbilityHintLevel: 0 },
        ],
      }),
    );
    expect(result.issues.some((i) => i.code === ERROR_CODES.GOLD_DATA_MISSING)).toBe(true);
    expect(result.status).toBe("incomplete");
  });

  it("UT-PLAN-11: base は display_order 昇順、blue はユーザー指定→自動追加(ID昇順)", () => {
    const result = calculatePlan(
      gameData,
      plan({
        playerType: "pitcher",
        senseMode: "sense_plus",
        currentBase: { stamina: 40, velocity: 130, control: 40 },
        targetBase: { stamina: 41, velocity: 131, control: 41 },
        blueTargets: [
          { abilityId: "strikeout", currentState: "NONE", targetState: "ON", hintLevel: 0 },
        ],
        goldTargets: [
          { abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel: 0 },
          { abilityId: "clutch_master", hintLevel: 0, lowerAbilityHintLevel: 0 },
        ],
      }),
    );
    expect(result.base.map((i) => i.id)).toEqual(["velocity", "control", "stamina"]);
    expect(result.blue.map((i) => i.id)).toEqual(["strikeout", "chance", "power_hitter"]);
  });

  it("UT-PLAN-12: マージ後に現在状態が目標以上なら cost 0", () => {
    const result = calculatePlan(
      gameData,
      plan({
        senseMode: "normal",
        blueTargets: [{ abilityId: "chance", currentState: "A", targetState: "C", hintLevel: 0 }],
      }),
    );
    expect(result.blue[0]?.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(result.status).toBe("confirmed");
  });

  it("UT-PLAN-13: 同じプランを2回計算しても結果が等しい", () => {
    const target = plan({
      senseMode: "sense_plus",
      currentBase: { contact: 40 },
      targetBase: { contact: 43 },
      blueTargets: [{ abilityId: "chance", currentState: "G", targetState: "C", hintLevel: 1 }],
      goldTargets: [{ abilityId: "archartist", hintLevel: 2, lowerAbilityHintLevel: 1 }],
    });
    expect(calculatePlan(gameData, target)).toEqual(calculatePlan(gameData, target));
  });

  it("UT-PLAN-14: 下位青特のコツLvと金特のコツLvは独立に効く", () => {
    const build = (lowerAbilityHintLevel: number): PlayerPlan =>
      plan({
        goldTargets: [{ abilityId: "archartist", hintLevel: 1, lowerAbilityHintLevel }],
      });
    const low = calculatePlan(gameData, build(0));
    const high = calculatePlan(gameData, build(2));
    expect(low.blue[0]?.cost).toEqual(v(216, 13, 61, 0, 7));
    expect(high.blue[0]?.cost).toEqual(v(108, 6, 30, 0, 3));
    expect(low.gold[0]?.cost).toEqual(high.gold[0]?.cost);
  });

  it("基礎能力の初期値が未入力なら変化なしとして扱う", () => {
    const result = calculatePlan(
      gameData,
      plan({ senseMode: "sense_plus", targetBase: { contact: 42 } }),
    );
    expect(result.base[0]?.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(result.issues).toHaveLength(0);
  });

  it("投手プランでは変化球が計算される", () => {
    const result = calculatePlan(
      gameData,
      plan({
        playerType: "pitcher",
        senseMode: "sense_plus",
        breakingPlan: {
          composition: [{ pitchType: "slider", level: 2 }],
          mode: "aggregate",
          aggregate: v(0, 0, 100, 500, 0),
          steps: [],
        },
      }),
    );
    expect(result.subtotal.breaking).toEqual(v(0, 0, 100, 500, 0));
    expect(result.total).toEqual(addVector(v(0, 0, 100, 500, 0), v(0, 0, 0, 0, 0)));
  });

  it("未登録の基礎能力は BASE_DATA_MISSING を報告する", () => {
    const result = calculatePlan(
      gameData,
      plan({ currentBase: { unknown: 1 }, targetBase: { unknown: 2 } }),
    );
    expect(result.issues[0]?.code).toBe(ERROR_CODES.BASE_DATA_MISSING);
    expect(result.status).toBe("incomplete");
  });
});
