/**
 * 11_unit_test_spec.md §1 の標準フィクスチャ（= public/data/sample2024/）を
 * GameDataSet として組み立てる。domain 層の単体テストは CSV 読込層に依存させないため、
 * ここでは data 層を使わず直接インデックスを構築する。
 */
import type {
  BaseAbilityDef,
  BaseCostRow,
  BlueAbilityMeta,
  BlueAbilityRow,
  BreakingCacheRow,
  GoldAbilityMeta,
  GoldAbilityRow,
  GoldPrerequisite,
  HintRule,
  PlayerType,
  SenseMode,
} from "@/domain/models/ability";
import { statesOf } from "@/domain/models/ability";
import type { ExpVector } from "@/domain/models/expVector";
import type { GameDataSet } from "@/domain/models/gameData";
import {
  baseDefKey,
  baseKey,
  blueKey,
  breakingKey,
  goldByAbilityKey,
  goldKey,
  hintKey,
} from "@/domain/keys";

export const v = (
  muscle: number,
  agility: number,
  technique: number,
  breaking: number,
  mental: number,
): ExpVector => ({ muscle, agility, technique, breaking, mental });

type BaseTuple = [PlayerType, string, number, number, number, number, number, number];

const BASE_DEFS: BaseAbilityDef[] = [
  {
    abilityId: "trajectory",
    displayName: "弾道",
    playerType: "fielder",
    minValue: 1,
    maxValue: 4,
    displayOrder: 10,
    valueType: "trajectory",
  },
  {
    abilityId: "contact",
    displayName: "ミート",
    playerType: "fielder",
    minValue: 1,
    maxValue: 100,
    displayOrder: 20,
    valueType: "numeric",
  },
  {
    abilityId: "power",
    displayName: "パワー",
    playerType: "fielder",
    minValue: 1,
    maxValue: 100,
    displayOrder: 30,
    valueType: "numeric",
  },
  {
    abilityId: "velocity",
    displayName: "球速",
    playerType: "pitcher",
    minValue: 100,
    maxValue: 170,
    displayOrder: 10,
    valueType: "numeric",
  },
  {
    abilityId: "control",
    displayName: "コントロール",
    playerType: "pitcher",
    minValue: 1,
    maxValue: 100,
    displayOrder: 20,
    valueType: "numeric",
  },
  {
    abilityId: "stamina",
    displayName: "スタミナ",
    playerType: "pitcher",
    minValue: 1,
    maxValue: 100,
    displayOrder: 30,
    valueType: "numeric",
  },
];

const BASE_SENSE_PLUS: BaseTuple[] = [
  ["pitcher", "velocity", 128, 10, 0, 5, 0, 0],
  ["pitcher", "velocity", 129, 10, 0, 5, 0, 0],
  ["pitcher", "velocity", 130, 10, 0, 5, 0, 0],
  ["pitcher", "velocity", 131, 10, 0, 5, 0, 0],
  ["pitcher", "velocity", 132, 12, 0, 6, 0, 0],
  ["pitcher", "velocity", 133, 12, 0, 6, 0, 0],
  ["pitcher", "control", 40, 0, 0, 4, 0, 3],
  ["pitcher", "control", 41, 0, 0, 4, 0, 3],
  ["pitcher", "stamina", 40, 0, 0, 3, 0, 5],
  ["fielder", "contact", 40, 1, 0, 5, 0, 7],
  ["fielder", "contact", 41, 1, 0, 5, 0, 7],
  ["fielder", "contact", 42, 1, 0, 6, 0, 8],
  ["fielder", "contact", 43, 1, 0, 6, 0, 8],
  ["fielder", "contact", 44, 2, 0, 7, 0, 9],
  ["fielder", "power", 40, 5, 0, 1, 0, 7],
  ["fielder", "trajectory", 1, 50, 0, 0, 0, 20],
  ["fielder", "trajectory", 2, 80, 0, 0, 0, 35],
  ["fielder", "trajectory", 3, 120, 0, 0, 0, 50],
];

const BASE_NORMAL: BaseTuple[] = [
  ["pitcher", "velocity", 130, 20, 0, 10, 0, 0],
  ["pitcher", "velocity", 131, 20, 0, 10, 0, 0],
  ["fielder", "contact", 40, 2, 0, 10, 0, 14],
];

function buildBaseMap(rows: BaseTuple[]): Map<string, BaseCostRow> {
  const map = new Map<string, BaseCostRow>();
  for (const [playerType, abilityId, fromValue, m, a, t, b, me] of rows) {
    map.set(baseKey(playerType, abilityId, fromValue), {
      playerType,
      abilityId,
      fromValue,
      toValue: fromValue + 1,
      cost: v(m, a, t, b, me),
    });
  }
  return map;
}

type BlueTuple = [
  string,
  string,
  PlayerType,
  "binary" | "rank",
  string,
  string,
  number,
  SenseMode,
  number,
  number,
  number,
  number,
  number,
];

const BLUE_ROWS: BlueTuple[] = [
  ["power_hitter", "パワーヒッター", "fielder", "binary", "NONE", "ON", 0, "normal", 240, 15, 68, 0, 8],
  ["average_hitter", "アベレージヒッター", "fielder", "binary", "NONE", "ON", 0, "normal", 23, 38, 195, 0, 83],
  ["average_hitter", "アベレージヒッター", "fielder", "binary", "NONE", "ON", 2, "normal", 12, 20, 100, 0, 45],
  ["strikeout", "奪三振", "pitcher", "binary", "NONE", "ON", 0, "normal", 35, 0, 80, 50, 35],
  ["test_round", "丸め検証", "common", "binary", "NONE", "ON", 0, "normal", 5, 7, 9, 11, 13],
  ["chance", "チャンス", "fielder", "rank", "G", "F", 0, "normal", 0, 8, 14, 0, 50],
  ["chance", "チャンス", "fielder", "rank", "F", "E", 0, "normal", 0, 10, 18, 0, 62],
  ["chance", "チャンス", "fielder", "rank", "E", "D", 0, "normal", 0, 13, 22, 0, 80],
  ["chance", "チャンス", "fielder", "rank", "D", "C", 0, "normal", 0, 16, 28, 0, 100],
  ["chance", "チャンス", "fielder", "rank", "D", "C", 1, "normal", 0, 15, 25, 0, 90],
  ["chance", "チャンス", "fielder", "rank", "C", "B", 0, "normal", 0, 20, 35, 0, 125],
  ["chance", "チャンス", "fielder", "rank", "B", "A", 0, "normal", 0, 24, 42, 0, 150],
];

type GoldTuple = [
  string,
  string,
  PlayerType,
  number,
  SenseMode,
  number,
  number,
  number,
  number,
  number,
];

const GOLD_ROWS: GoldTuple[] = [
  ["archartist", "アーチスト", "fielder", 1, "sense_plus", 100, 10, 50, 0, 20],
  ["archartist", "アーチスト", "fielder", 3, "sense_plus", 60, 6, 30, 0, 12],
  ["doctor_k", "ドクターK", "pitcher", 1, "sense_plus", 50, 0, 100, 70, 40],
  ["clutch_master", "クラッチマスター", "fielder", 0, "sense_plus", 300, 30, 150, 0, 60],
  ["laser_beam", "レーザービーム", "fielder", 1, "sense_plus", 80, 40, 60, 0, 20],
];

const GOLD_PREREQ_ROWS: GoldPrerequisite[] = [
  { goldId: "archartist", lowerBlueId: "power_hitter", requiredState: "ON" },
  { goldId: "doctor_k", lowerBlueId: "strikeout", requiredState: "ON" },
  { goldId: "clutch_master", lowerBlueId: "chance", requiredState: "A" },
];

const HINT_MULTIPLIERS: Array<[number, number]> = [
  [0, 1.0],
  [1, 0.7],
  [2, 0.5],
  [3, 0.4],
  [4, 0.3],
  [5, 0.2],
];

type BreakingTuple = [string, number, number, number, number, number, number, number, number];

const BREAKING_SENSE_PLUS: BreakingTuple[] = [
  ["slider", 1, 1, 1, 0, 0, 10, 50, 0],
  ["slider", 2, 2, 1, 0, 0, 12, 60, 0],
  ["curve", 0, 3, 1, 0, 0, 25, 110, 0],
];

const BREAKING_NORMAL: BreakingTuple[] = [["slider", 1, 1, 1, 0, 0, 20, 100, 0]];

function buildBreakingMap(rows: BreakingTuple[]): Map<string, BreakingCacheRow> {
  const map = new Map<string, BreakingCacheRow>();
  for (const [pitchType, fromLevel, totalBreakBefore, pitchCountBefore, m, a, t, b, me] of rows) {
    map.set(breakingKey(pitchType, fromLevel, totalBreakBefore, pitchCountBefore), {
      pitchType,
      fromLevel,
      toLevel: fromLevel + 1,
      totalBreakBefore,
      pitchCountBefore,
      cost: v(m, a, t, b, me),
    });
  }
  return map;
}

export function createSampleGameData(): GameDataSet {
  const baseDefs = new Map<string, BaseAbilityDef>();
  for (const def of BASE_DEFS) {
    baseDefs.set(baseDefKey(def.playerType, def.abilityId), def);
  }

  const blue = new Map<string, BlueAbilityRow>();
  const blueIndex = new Map<string, BlueAbilityMeta>();
  for (const row of BLUE_ROWS) {
    const [
      abilityId,
      displayName,
      playerType,
      abilityType,
      fromState,
      toState,
      hintLevel,
      senseMode,
      m,
      a,
      t,
      b,
      me,
    ] = row;
    blue.set(blueKey(abilityId, playerType, fromState, hintLevel, senseMode), {
      abilityId,
      displayName,
      playerType,
      abilityType,
      fromState,
      toState,
      hintLevel,
      senseMode,
      cost: v(m, a, t, b, me),
    });
    // 遷移一覧は基準行（Lv0 / normal）から構築する
    if (hintLevel === 0 && senseMode === "normal" && !blueIndex.has(abilityId)) {
      blueIndex.set(abilityId, {
        abilityId,
        displayName,
        playerType,
        abilityType,
        states: statesOf(abilityType),
      });
    }
  }

  const gold = new Map<string, GoldAbilityRow>();
  const goldByAbility = new Map<string, GoldAbilityRow[]>();
  const goldIndex = new Map<string, GoldAbilityMeta>();
  for (const goldRow of GOLD_ROWS) {
    const [abilityId, displayName, playerType, hintLevel, senseMode, m, a, t, b, me] = goldRow;
    const row: GoldAbilityRow = {
      abilityId,
      displayName,
      playerType,
      hintLevel,
      senseMode,
      cost: v(m, a, t, b, me),
    };
    gold.set(goldKey(abilityId, playerType, hintLevel, senseMode), row);
    const listKey = goldByAbilityKey(abilityId, senseMode);
    const list = goldByAbility.get(listKey);
    if (list) {
      list.push(row);
    } else {
      goldByAbility.set(listKey, [row]);
    }
    if (!goldIndex.has(abilityId)) {
      goldIndex.set(abilityId, { abilityId, displayName, playerType });
    }
  }

  const goldPrereq = new Map<string, GoldPrerequisite[]>();
  for (const prereq of GOLD_PREREQ_ROWS) {
    const list = goldPrereq.get(prereq.goldId);
    if (list) {
      list.push(prereq);
    } else {
      goldPrereq.set(prereq.goldId, [prereq]);
    }
  }

  const hintRules = new Map<string, HintRule>();
  for (const abilityType of ["blue", "gold"] as const) {
    for (const [hintLevel, multiplier] of HINT_MULTIPLIERS) {
      hintRules.set(hintKey(abilityType, hintLevel), {
        abilityType,
        hintLevel,
        multiplier,
        rounding: "floor",
      });
    }
  }

  return {
    gameId: "sample2024",
    config: {
      blueSensePlusMultiplier: 0.9,
      blueNormalMultiplier: 1.0,
      goldEstimateSearchMax: 10000,
    },
    baseDefs,
    baseDefList: [...BASE_DEFS].sort((x, y) => x.displayOrder - y.displayOrder),
    baseSensePlus: buildBaseMap(BASE_SENSE_PLUS),
    baseNormal: buildBaseMap(BASE_NORMAL),
    blue,
    blueIndex,
    gold,
    goldByAbility,
    goldIndex,
    goldPrereq,
    hintRules,
    breakingSensePlus: buildBreakingMap(BREAKING_SENSE_PLUS),
    breakingNormal: buildBreakingMap(BREAKING_NORMAL),
  };
}
