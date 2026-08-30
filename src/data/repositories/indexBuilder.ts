/**
 * 検証済みCSV行から GameDataSet（Map インデックス集合）を構築する。
 * 計算経路の検索はすべて Map の O(1) 参照とし、線形探索を残さない（02_architecture.md §7）。
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
  SenseMode,
} from "@/domain/models/ability";
import { statesOf } from "@/domain/models/ability";
import type { GameConfig, GameDataSet } from "@/domain/models/gameData";
import { CONFIG_KEY_SPECS } from "../csv/schemas";
import type { ConfigRow, ValidatedGameData } from "../csv/validators";
import {
  baseDefKey,
  baseKey,
  blueKey,
  breakingKey,
  goldByAbilityKey,
  goldKey,
  hintKey,
} from "./keyBuilder";

/** config.csv の行から設定値を解決する。未定義キーは既定値（03_data_spec.md §3）。 */
export function resolveGameConfig(rows: ConfigRow[]): GameConfig {
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: string): number => {
    const spec = CONFIG_KEY_SPECS[key];
    const defaultValue = spec?.defaultValue ?? 0;
    const raw = values.get(key);
    if (raw === undefined || raw === "") return defaultValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };
  return {
    blueSensePlusMultiplier: read("blue_sense_plus_multiplier"),
    blueNormalMultiplier: read("blue_normal_multiplier"),
    goldEstimateSearchMax: read("gold_estimate_search_max"),
  };
}

function buildBaseCostMap(rows: BaseCostRow[]): Map<string, BaseCostRow> {
  const map = new Map<string, BaseCostRow>();
  for (const row of rows) {
    map.set(baseKey(row.playerType, row.abilityId, row.fromValue), {
      playerType: row.playerType,
      abilityId: row.abilityId,
      fromValue: row.fromValue,
      toValue: row.toValue,
      cost: row.cost,
    });
  }
  return map;
}

function buildBreakingMap(rows: BreakingCacheRow[]): Map<string, BreakingCacheRow> {
  const map = new Map<string, BreakingCacheRow>();
  for (const row of rows) {
    map.set(breakingKey(row.pitchType, row.fromLevel, row.totalBreakBefore, row.pitchCountBefore), {
      pitchType: row.pitchType,
      fromLevel: row.fromLevel,
      toLevel: row.toLevel,
      totalBreakBefore: row.totalBreakBefore,
      pitchCountBefore: row.pitchCountBefore,
      cost: row.cost,
    });
  }
  return map;
}

export function buildGameDataSet(gameId: string, data: ValidatedGameData): GameDataSet {
  const baseDefs = new Map<string, BaseAbilityDef>();
  const baseDefList: BaseAbilityDef[] = [];
  for (const row of data.base_ability_defs) {
    const def: BaseAbilityDef = {
      abilityId: row.abilityId,
      displayName: row.displayName,
      playerType: row.playerType,
      minValue: row.minValue,
      maxValue: row.maxValue,
      displayOrder: row.displayOrder,
      valueType: row.valueType,
    };
    baseDefs.set(baseDefKey(def.playerType, def.abilityId), def);
    baseDefList.push(def);
  }
  // display_order 昇順。同値は CSV の記載順を保つ（Array#sort は安定ソート）
  baseDefList.sort((a, b) => a.displayOrder - b.displayOrder);

  const blue = new Map<string, BlueAbilityRow>();
  const blueIndex = new Map<string, BlueAbilityMeta>();
  for (const row of data.blue_abilities) {
    const value: BlueAbilityRow = {
      abilityId: row.abilityId,
      displayName: row.displayName,
      playerType: row.playerType,
      abilityType: row.abilityType,
      fromState: row.fromState,
      toState: row.toState,
      hintLevel: row.hintLevel,
      senseMode: row.senseMode,
      cost: row.cost,
    };
    blue.set(
      blueKey(row.abilityId, row.playerType, row.fromState, row.hintLevel, row.senseMode),
      value,
    );
    // メタ情報は基準行（Lv0 / normal）から作る。V-27 により全遷移に必ず存在する。
    if (row.hintLevel === 0 && row.senseMode === "normal" && !blueIndex.has(row.abilityId)) {
      blueIndex.set(row.abilityId, {
        abilityId: row.abilityId,
        displayName: row.displayName,
        playerType: row.playerType,
        abilityType: row.abilityType,
        states: statesOf(row.abilityType),
      });
    }
  }

  const gold = new Map<string, GoldAbilityRow>();
  const goldByAbility = new Map<string, GoldAbilityRow[]>();
  const goldIndex = new Map<string, GoldAbilityMeta>();
  for (const row of data.gold_abilities) {
    const value: GoldAbilityRow = {
      abilityId: row.abilityId,
      displayName: row.displayName,
      playerType: row.playerType,
      hintLevel: row.hintLevel,
      senseMode: row.senseMode,
      cost: row.cost,
    };
    gold.set(goldKey(row.abilityId, row.playerType, row.hintLevel, row.senseMode), value);
    // 推定は senseMode を跨いではならないため、実測一覧も senseMode 別に分ける
    const listKey = goldByAbilityKey(row.abilityId, row.senseMode);
    const list = goldByAbility.get(listKey);
    if (list) list.push(value);
    else goldByAbility.set(listKey, [value]);
    if (!goldIndex.has(row.abilityId)) {
      goldIndex.set(row.abilityId, {
        abilityId: row.abilityId,
        displayName: row.displayName,
        playerType: row.playerType,
      });
    }
  }
  for (const list of goldByAbility.values()) {
    list.sort((a, b) => a.hintLevel - b.hintLevel);
  }

  const goldPrereq = new Map<string, GoldPrerequisite[]>();
  for (const row of data.gold_prerequisites) {
    const value: GoldPrerequisite = {
      goldId: row.goldId,
      lowerBlueId: row.lowerBlueId,
      requiredState: row.requiredState,
    };
    const list = goldPrereq.get(row.goldId);
    if (list) list.push(value);
    else goldPrereq.set(row.goldId, [value]);
  }

  const hintRules = new Map<string, HintRule>();
  for (const row of data.hint_rules) {
    hintRules.set(hintKey(row.abilityType, row.hintLevel), {
      abilityType: row.abilityType,
      hintLevel: row.hintLevel,
      multiplier: row.multiplier,
      rounding: row.rounding,
    });
  }

  return {
    gameId,
    config: resolveGameConfig(data.config),
    baseDefs,
    baseDefList,
    baseSensePlus: buildBaseCostMap(data.base_sense_plus),
    baseNormal: buildBaseCostMap(data.base_normal),
    blue,
    blueIndex,
    gold,
    goldByAbility,
    goldIndex,
    goldPrereq,
    hintRules,
    breakingSensePlus: buildBreakingMap(data.breaking_cache_sense_plus),
    breakingNormal: buildBreakingMap(data.breaking_cache_normal),
  };
}

/**
 * 変化球共通キャッシュへユーザー登録分を追記マージする（06_persistence_spec.md §2）。
 * キーが重複した場合はユーザー登録分を優先する。
 */
export function mergeBreakingCache(
  gameData: GameDataSet,
  senseMode: SenseMode,
  rows: BreakingCacheRow[],
): void {
  const target = senseMode === "sense_plus" ? gameData.breakingSensePlus : gameData.breakingNormal;
  for (const row of rows) {
    target.set(
      breakingKey(row.pitchType, row.fromLevel, row.totalBreakBefore, row.pitchCountBefore),
      row,
    );
  }
}
