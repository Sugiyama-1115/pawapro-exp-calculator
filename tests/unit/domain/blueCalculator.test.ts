import { beforeAll, describe, expect, it } from "vitest";
import { calculateBlueAbility } from "@/domain/calculator/blueCalculator";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { SenseMode } from "@/domain/models/ability";
import type { GameDataSet } from "@/domain/models/gameData";
import type { BlueTarget } from "@/domain/models/plan";
import { createSampleGameData, v } from "../../fixtures/sampleGameData";

let gameData: GameDataSet;

beforeAll(() => {
  gameData = createSampleGameData();
});

const target = (
  abilityId: string,
  currentState: string,
  targetState: string,
  hintLevel: number,
): BlueTarget => ({ abilityId, currentState, targetState, hintLevel });

const run = (senseMode: SenseMode, t: BlueTarget) => calculateBlueAbility(gameData, senseMode, t);

describe("calculateBlueAbility", () => {
  it("UT-BLUE-01: power_hitter NONE→ON / Lv0 / normal は基準行に一致", () => {
    const r = run("normal", target("power_hitter", "NONE", "ON", 0));
    expect(r.item?.cost).toEqual(v(240, 15, 68, 0, 8));
    expect(r.item?.source).toBe("measured");
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BLUE-02: power_hitter NONE→ON / Lv2 / normal", () => {
    const r = run("normal", target("power_hitter", "NONE", "ON", 2));
    expect(r.item?.cost).toEqual(v(120, 7, 34, 0, 4));
    expect(r.item?.source).toBe("master");
  });

  it("UT-BLUE-03: power_hitter NONE→ON / Lv1 / sense_plus", () => {
    const r = run("sense_plus", target("power_hitter", "NONE", "ON", 1));
    expect(r.item?.cost).toEqual(v(151, 9, 42, 0, 5));
    expect(r.item?.source).toBe("master");
  });

  it("UT-BLUE-04: chance D→A / Lv0 / normal は3遷移の合計", () => {
    const r = run("normal", target("chance", "D", "A", 0));
    expect(r.item?.cost).toEqual(v(0, 60, 105, 0, 375));
  });

  it("UT-BLUE-05: chance D→D は cost 0 / issue なし", () => {
    const r = run("normal", target("chance", "D", "D", 0));
    expect(r.item?.cost).toEqual(v(0, 0, 0, 0, 0));
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BLUE-06: chance A→D は INVALID_TARGET", () => {
    const r = run("normal", target("chance", "A", "D", 0));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_TARGET);
  });

  it("UT-BLUE-07: chance G→A / Lv0 / normal は6遷移の合計", () => {
    const r = run("normal", target("chance", "G", "A", 0));
    expect(r.item?.cost).toEqual(v(0, 91, 159, 0, 567));
  });

  it("UT-BLUE-09: chance D→A / Lv3 / sense_plus", () => {
    const r = run("sense_plus", target("chance", "D", "A", 3));
    expect(r.item?.cost).toEqual(v(0, 21, 37, 0, 135));
    expect(r.item?.source).toBe("master");
  });

  it("UT-BLUE-10: 丸めは最後に1回のみ（test_round Lv1 / sense_plus）", () => {
    const r = run("sense_plus", target("test_round", "NONE", "ON", 1));
    expect(r.item?.cost).toEqual(v(3, 4, 5, 6, 8));
    expect(r.item?.cost).not.toEqual(v(2, 3, 5, 6, 8));
  });

  it("UT-BLUE-08: 未登録の ability_id は BLUE_DATA_MISSING", () => {
    const r = run("normal", target("unknown_blue", "NONE", "ON", 0));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BLUE_DATA_MISSING);
  });

  it("UT-BLUE-11: ランク遷移は1段階のみ加算（chance E→D）", () => {
    const r = run("normal", target("chance", "E", "D", 0));
    expect(r.item?.cost).toEqual(v(0, 13, 22, 0, 80));
  });

  it("UT-BLUE-12: 能力自身の player_type で解決する（投手プランでの power_hitter）", () => {
    const r = run("normal", target("power_hitter", "NONE", "ON", 0));
    expect(r.item?.cost).toEqual(v(240, 15, 68, 0, 8));
    expect(r.item?.source).toBe("measured");
    expect(r.issues).toHaveLength(0);
  });

  it("UT-BLUE-13: 実測パス（average_hitter Lv2 / normal）", () => {
    const r = run("normal", target("average_hitter", "NONE", "ON", 2));
    expect(r.item?.cost).toEqual(v(12, 20, 100, 0, 45));
    expect(r.item?.source).toBe("measured");
    expect(r.item?.cost).not.toEqual(v(11, 19, 97, 0, 41));
  });

  it("UT-BLUE-14: sense_mode 不一致なら基準行パス（average_hitter Lv2 / sense_plus）", () => {
    const r = run("sense_plus", target("average_hitter", "NONE", "ON", 2));
    expect(r.item?.cost).toEqual(v(10, 17, 87, 0, 37));
    expect(r.item?.source).toBe("master");
  });

  it("UT-BLUE-15: 実測パスと基準行パスの混在禁止（chance D→A / Lv1 / normal）", () => {
    const r = run("normal", target("chance", "D", "A", 1));
    expect(r.item?.cost).toEqual(v(0, 42, 73, 0, 262));
    expect(r.item?.source).toBe("master");
    expect(r.item?.cost).not.toEqual(v(0, 45, 78, 0, 282));
  });

  it("UT-BLUE-16: 単一遷移が完全一致（chance D→C / Lv1 / normal）", () => {
    const r = run("normal", target("chance", "D", "C", 1));
    expect(r.item?.cost).toEqual(v(0, 15, 25, 0, 90));
    expect(r.item?.source).toBe("measured");
    expect(r.item?.cost).not.toEqual(v(0, 11, 19, 0, 70));
  });

  it("UT-BLUE-17: 実測行を持たない能力は基準行パス（strikeout Lv2 / normal）", () => {
    const r = run("normal", target("strikeout", "NONE", "ON", 2));
    expect(r.item?.cost).toEqual(v(17, 0, 40, 25, 17));
    expect(r.item?.source).toBe("master");
  });

  it("不正な状態値は INVALID_TARGET", () => {
    const r = run("normal", target("chance", "Z", "A", 0));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_TARGET);
  });

  it("hint_rules に該当行が無ければ INVALID_CSV", () => {
    const broken = createSampleGameData();
    broken.hintRules.delete("blue|2");
    const r = calculateBlueAbility(broken, "normal", target("power_hitter", "NONE", "ON", 2));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.INVALID_CSV);
  });

  it("基準行が欠けている遷移は BLUE_DATA_MISSING", () => {
    const broken = createSampleGameData();
    broken.blue.delete("chance|fielder|C|0|normal");
    const r = calculateBlueAbility(broken, "normal", target("chance", "D", "A", 0));
    expect(r.item).toBeNull();
    expect(r.issues[0]?.code).toBe(ERROR_CODES.BLUE_DATA_MISSING);
  });

  it("common 行へフォールバックして解決する（test_round）", () => {
    const r = run("normal", target("test_round", "NONE", "ON", 0));
    expect(r.item?.cost).toEqual(v(5, 7, 9, 11, 13));
  });
});
