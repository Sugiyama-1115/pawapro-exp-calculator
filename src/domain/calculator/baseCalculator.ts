import { ERROR_CODES } from "../errors/errorCodes";
import { baseDefKey, baseKey } from "../keys";
import type { BaseCostRow, SenseMode } from "../models/ability";
import type { ExpVector } from "../models/expVector";
import { addVector, zeroVector } from "../models/expVector";
import type { GameDataSet } from "../models/gameData";
import type { CalculationIssue } from "../models/result";

export interface BaseCalculationOutcome {
  cost: ExpVector;
  issues: CalculationIssue[];
}

/**
 * 基礎能力の必要経験点（04_calculation_spec.md §3）。
 * センス差はテーブルの差で表現するため、ここで倍率計算は一切行わない。
 */
export function calculateBaseAbility(
  gameData: GameDataSet,
  playerType: "pitcher" | "fielder",
  senseMode: SenseMode,
  abilityId: string,
  currentValue: number,
  targetValue: number,
): BaseCalculationOutcome {
  const issues: CalculationIssue[] = [];
  const def = gameData.baseDefs.get(baseDefKey(playerType, abilityId));
  const displayName = def?.displayName ?? abilityId;

  if (targetValue < currentValue) {
    issues.push({
      code: ERROR_CODES.INVALID_TARGET,
      category: "base",
      targetId: abilityId,
      message: `${displayName} の目標値は初期値以上にしてください。`,
    });
    return { cost: zeroVector(), issues };
  }

  if (def && !inRange(def.minValue, def.maxValue, currentValue, targetValue)) {
    issues.push({
      code: ERROR_CODES.INVALID_TARGET,
      category: "base",
      targetId: abilityId,
      message: `${displayName} の値は ${def.minValue}〜${def.maxValue} の範囲で入力してください。`,
    });
    return { cost: zeroVector(), issues };
  }

  if (targetValue === currentValue) {
    return { cost: zeroVector(), issues };
  }

  const table = senseMode === "sense_plus" ? gameData.baseSensePlus : gameData.baseNormal;
  const fileName = senseMode === "sense_plus" ? "base_sense_plus.csv" : "base_normal.csv";

  let total = zeroVector();
  for (let value = currentValue; value < targetValue; value++) {
    const row = resolveBaseRow(table, playerType, abilityId, value);
    if (!row) {
      // 欠落段階を 0 で補完すると過小な合計が「確定値」に見えてしまうため、そこで打ち切る
      issues.push({
        code: ERROR_CODES.BASE_DATA_MISSING,
        category: "base",
        targetId: abilityId,
        message: `${displayName} ${value}→${value + 1} の経験点データがありません。${fileName} を確認してください。`,
      });
      break;
    }
    total = addVector(total, row.cost);
  }

  return { cost: total, issues };
}

function inRange(min: number, max: number, currentValue: number, targetValue: number): boolean {
  return (
    currentValue >= min && currentValue <= max && targetValue >= min && targetValue <= max
  );
}

function resolveBaseRow(
  table: Map<string, BaseCostRow>,
  playerType: string,
  abilityId: string,
  fromValue: number,
): BaseCostRow | undefined {
  return (
    table.get(baseKey(playerType, abilityId, fromValue)) ??
    table.get(baseKey("common", abilityId, fromValue))
  );
}
