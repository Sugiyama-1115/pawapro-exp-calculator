import { describe, expect, it } from "vitest";
import { emptyGameData, validateDataSet } from "@/data/csv/validators";
import { buildGameDataSet, mergeBreakingCache, resolveGameConfig } from "@/data/repositories/indexBuilder";
import {
  baseKey,
  blueKey,
  breakingKey,
  goldByAbilityKey,
  goldKey,
  hintKey,
} from "@/data/repositories/keyBuilder";
import { calculateBaseAbility } from "@/domain/calculator/baseCalculator";
import { parseValidFixtures } from "../../fixtures/csvFixtures";

describe("keyBuilder", () => {
  it("UT-KEY-01: baseKey", () => {
    expect(baseKey("pitcher", "velocity", 130)).toBe("pitcher|velocity|130");
  });

  it("UT-KEY-02: blueKey", () => {
    expect(blueKey("chance", "fielder", "D", 0, "normal")).toBe("chance|fielder|D|0|normal");
  });

  it("UT-KEY-03: goldKey", () => {
    expect(goldKey("archartist", "fielder", 3, "sense_plus")).toBe(
      "archartist|fielder|3|sense_plus",
    );
  });

  it("UT-KEY-04: hintKey", () => {
    expect(hintKey("gold", 3)).toBe("gold|3");
  });

  it("UT-KEY-05: breakingKey", () => {
    expect(breakingKey("slider", 2, 5, 2)).toBe("slider|2|5|2");
  });
});

function buildFromFixtures() {
  const result = validateDataSet(parseValidFixtures());
  if (!result.data) throw new Error("標準フィクスチャの検証に失敗した");
  return buildGameDataSet("sample2024", result.data);
}

describe("indexBuilder", () => {
  it("UT-IDX-01: common 行と player_type 一致行が両方ある場合は一致行が優先される", () => {
    const data = emptyGameData();
    data.base_ability_defs = [
      {
        abilityId: "control",
        displayName: "コントロール",
        playerType: "pitcher",
        minValue: 1,
        maxValue: 100,
        displayOrder: 20,
        valueType: "numeric",
        line: 2,
      },
    ];
    data.base_sense_plus = [
      {
        playerType: "common",
        abilityId: "control",
        fromValue: 40,
        toValue: 41,
        cost: { muscle: 99, agility: 0, technique: 0, breaking: 0, mental: 0 },
        line: 2,
      },
      {
        playerType: "pitcher",
        abilityId: "control",
        fromValue: 40,
        toValue: 41,
        cost: { muscle: 1, agility: 0, technique: 0, breaking: 0, mental: 0 },
        line: 3,
      },
    ];
    const gameData = buildGameDataSet("test", data);

    expect(gameData.baseSensePlus.get(baseKey("common", "control", 40))?.cost.muscle).toBe(99);
    expect(gameData.baseSensePlus.get(baseKey("pitcher", "control", 40))?.cost.muscle).toBe(1);

    const outcome = calculateBaseAbility(gameData, "pitcher", "sense_plus", "control", 40, 41);
    expect(outcome.cost.muscle).toBe(1);
  });

  it("UT-IDX-02: goldByAbility は senseMode 別に分かれる", () => {
    const gameData = buildFromFixtures();
    expect(gameData.goldByAbility.get(goldByAbilityKey("archartist", "sense_plus"))).toHaveLength(2);
    expect(gameData.goldByAbility.get(goldByAbilityKey("archartist", "normal"))).toBeUndefined();
  });

  it("UT-IDX-03: 検索経路はすべて Map 参照（線形探索を持たない）", () => {
    const gameData = buildFromFixtures();
    for (const index of [
      gameData.baseDefs,
      gameData.baseSensePlus,
      gameData.baseNormal,
      gameData.blue,
      gameData.blueIndex,
      gameData.gold,
      gameData.goldByAbility,
      gameData.goldIndex,
      gameData.goldPrereq,
      gameData.hintRules,
      gameData.breakingSensePlus,
      gameData.breakingNormal,
    ]) {
      expect(index).toBeInstanceOf(Map);
    }
  });

  it("基礎能力定義は display_order 昇順に並ぶ", () => {
    const gameData = buildFromFixtures();
    const orders = gameData.baseDefList.map((def) => def.displayOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("青特メタは基準行から作られ、rank の状態列を持つ", () => {
    const gameData = buildFromFixtures();
    expect(gameData.blueIndex.get("chance")?.states).toEqual(["G", "F", "E", "D", "C", "B", "A"]);
    expect(gameData.blueIndex.get("power_hitter")?.states).toEqual(["NONE", "ON"]);
  });

  it("config.csv の値が反映され、未定義キーは既定値になる", () => {
    expect(resolveGameConfig([{ key: "blue_sense_plus_multiplier", value: "0.90" }])).toEqual({
      blueSensePlusMultiplier: 0.9,
      blueNormalMultiplier: 1.0,
      goldEstimateSearchMax: 10000,
    });
  });

  it("変化球キャッシュの追記マージはキー重複時にユーザー登録分を優先する", () => {
    const gameData = buildFromFixtures();
    const key = breakingKey("slider", 1, 1, 1);
    expect(gameData.breakingSensePlus.get(key)?.cost.breaking).toBe(50);
    mergeBreakingCache(gameData, "sense_plus", [
      {
        pitchType: "slider",
        fromLevel: 1,
        toLevel: 2,
        totalBreakBefore: 1,
        pitchCountBefore: 1,
        cost: { muscle: 0, agility: 0, technique: 0, breaking: 999, mental: 0 },
      },
    ]);
    expect(gameData.breakingSensePlus.get(key)?.cost.breaking).toBe(999);
  });
});
