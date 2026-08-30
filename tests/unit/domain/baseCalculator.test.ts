import { beforeAll, describe, expect, it } from "vitest";
import { calculateBaseAbility } from "@/domain/calculator/baseCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { GameDataSet } from "@/domain/models/gameData";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

describe("calculateBaseAbility", () => {
  it("UT-BASE-01: pitcher / sense_plus / velocity 130→132", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 130, 132);
    expect(r.cost).toEqual(v(20, 0, 10, 0, 0));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BASE-02: pitcher / sense_plus / velocity 130→133", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 130, 133);
    expect(r.cost).toEqual(v(32, 0, 16, 0, 0));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BASE-03: 目標=初期 は cost 0 で issue なし", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 130, 130);
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BASE-04: 目標 < 初期 は INVALID_TARGET", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 133, 130);
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_TARGET);
  });

  it("UT-BASE-05: 段階欠落で BASE_DATA_MISSING（velocity 133→135）", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 133, 135);
    expect(r.cost).toEqual(v(12, 0, 6, 0, 0));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BASE_DATA_MISSING);
  });

  it("UT-BASE-06: normal は base_normal.csv を使用する", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "normal", "velocity", 130, 132);
    expect(r.cost).toEqual(v(40, 0, 20, 0, 0));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BASE-07: fielder / sense_plus / trajectory 1→2", () => {
    const r = calculateBaseAbility(gameData, "fielder", "sense_plus", "trajectory", 1, 2);
    expect(r.cost).toEqual(v(50, 0, 0, 0, 20));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BASE-08: max_value 超過は INVALID_TARGET", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 130, 180);
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_TARGET);
  });

  it("UT-BASE-09: 未登録の ability_id は BASE_DATA_MISSING", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "unknown_ability", 10, 11);
    expect(r.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BASE_DATA_MISSING);
  });

  it("UT-BASE-10: 欠落段階を 0 補完しない", () => {
    const r = calculateBaseAbility(gameData, "pitcher", "sense_plus", "velocity", 133, 135);
    expect(r.cost).not.toEqual(v(24, 0, 12, 0, 0));
  });

  it("min_value 未満の初期値も INVALID_TARGET", () => {
    const r = calculateBaseAbility(gameData, "fielder", "sense_plus", "trajectory", 0, 4);
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_TARGET);
  });
});
