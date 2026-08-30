import { beforeAll, describe, expect, it } from "vitest";
import { calculateGoldAbility } from "@/domain/calculator/goldCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { GameDataSet } from "@/domain/models/gameData";
import type { GoldTarget } from "@/domain/models/plan";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

const goldTarget = (abilityId: string, hintLevel: number): GoldTarget => ({
  abilityId,
  hintLevel,
  lowerAbilityHintLevel: 0,
});

describe("calculateGoldAbility", () => {
  it("UT-GOLD-01: archartist Lv1 / sense_plus は実測値", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 1));
    expect(r.item?.cost).toEqual(v(100, 10, 50, 0, 20));
    expect(r.item?.source).toBe("measured");
  });

  it("UT-GOLD-02: archartist Lv3 / sense_plus は推定せず実測値", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 3));
    expect(r.item?.cost).toEqual(v(60, 6, 30, 0, 12));
    expect(r.item?.source).toBe("measured");
  });

  it("UT-GOLD-03: archartist Lv2 は Lv1・Lv3 から高信頼推定", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 2));
    expect(r.item?.cost).toEqual(v(71, 7, 36, 0, 14));
    expect(r.item?.source).toBe("estimated_high");
  });

  it("UT-GOLD-04: doctor_k Lv3 は Lv1 のみから推定", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("doctor_k", 3));
    expect(r.item?.cost).toEqual(v(28, 0, 57, 40, 23));
    expect(r.item?.source).toBe("estimated");
  });

  it("UT-GOLD-05: 未登録の金特は GOLD_DATA_MISSING", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("unknown_gold", 1));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.GOLD_DATA_MISSING);
  });

  it("UT-GOLD-06: sense_mode 違いの実測行を流用しない", () => {
    const r = calculateGoldAbility(gameData, "normal", goldTarget("archartist", 1));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.GOLD_DATA_MISSING);
  });

  it("UT-GOLD-07: 金特にコツ倍率を二重適用しない", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 1));
    expect(r.item?.cost.muscle).toBe(100);
    expect(r.item?.cost.muscle).not.toBe(Math.floor(100 * 0.7));
  });

  it("UT-GOLD-08: 金特にセンス倍率を適用しない", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 1));
    expect(r.item?.cost.muscle).not.toBe(Math.floor(100 * 0.9));
  });

  it("detail にコツLvが入る", () => {
    const r = calculateGoldAbility(gameData, "sense_plus", goldTarget("archartist", 1));
    expect(r.item?.detail).toBe("コツLv1");
  });
});
