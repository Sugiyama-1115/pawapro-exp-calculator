import { hintKey } from "../keys";
import type { GoldAbilityRow, HintRule } from "../models/ability";
import type { ExpKey, ExpVector } from "../models/expVector";
import { EXP_KEYS, zeroVector } from "../models/expVector";
import { applyRounding } from "../rounding";

export interface GoldEstimation {
  cost: ExpVector;
  baseValues: ExpVector;
  confidence: "estimated" | "estimated_high";
}

/**
 * 金特の推定（04_calculation_spec.md §6）。
 * 仮想基礎値 B はカテゴリごとに独立して総当たりで逆算する。
 */
export function estimateGoldCost(
  measuredRows: GoldAbilityRow[],
  targetHintLevel: number,
  hintRules: Map<string, HintRule>,
  searchMax: number,
): GoldEstimation {
  const usableRows = measuredRows
    .map((row) => ({ row, rule: hintRules.get(hintKey("gold", row.hintLevel)) }))
    .filter((entry): entry is { row: GoldAbilityRow; rule: HintRule } => entry.rule !== undefined);

  const baseValues = zeroVector();
  for (const k of EXP_KEYS) {
    baseValues[k] = solveBaseValue(usableRows, k, searchMax);
  }

  const targetRule = hintRules.get(hintKey("gold", targetHintLevel));
  const cost = zeroVector();
  if (targetRule) {
    for (const k of EXP_KEYS) {
      cost[k] = applyRounding(baseValues[k] * targetRule.multiplier, targetRule.rounding);
    }
  }

  return {
    cost,
    baseValues,
    confidence: measuredRows.length >= 2 ? "estimated_high" : "estimated",
  };
}

function solveBaseValue(
  entries: Array<{ row: GoldAbilityRow; rule: HintRule }>,
  key: ExpKey,
  searchMax: number,
): number {
  let bestB = 0;
  let bestError = Number.POSITIVE_INFINITY;
  for (let b = 0; b <= searchMax; b++) {
    let totalError = 0;
    for (const { row, rule } of entries) {
      totalError += Math.abs(applyRounding(b * rule.multiplier, rule.rounding) - row.cost[key]);
    }
    // 厳密な "<" 比較のため、誤差が同点なら先に見つかった（より小さい）B が残る
    if (totalError < bestError) {
      bestError = totalError;
      bestB = b;
      if (bestError === 0) {
        break;
      }
    }
  }
  return bestB;
}
