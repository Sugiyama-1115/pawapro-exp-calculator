import { ERROR_CODES } from "../errors/errorCodes";
import { estimateGoldCost } from "../estimator/goldEstimator";
import { goldByAbilityKey } from "../keys";
import type { SenseMode } from "../models/ability";
import type { GameDataSet } from "../models/gameData";
import type { GoldTarget } from "../models/plan";
import type { CalculationIssue, CalculationItem } from "../models/result";

export interface GoldCalculationOutcome {
  item: CalculationItem | null;
  issues: CalculationIssue[];
}

/**
 * 金特の必要経験点（04_calculation_spec.md §5）。
 * CSV の値は当該 hint_level / sense_mode の実測値そのものなので、
 * コツ倍率・センス倍率を重ねて適用してはならない。
 */
export function calculateGoldAbility(
  gameData: GameDataSet,
  senseMode: SenseMode,
  target: GoldTarget,
): GoldCalculationOutcome {
  const issues: CalculationIssue[] = [];
  const displayName = gameData.goldIndex.get(target.abilityId)?.displayName ?? target.abilityId;
  const rows = gameData.goldByAbility.get(goldByAbilityKey(target.abilityId, senseMode)) ?? [];

  if (rows.length === 0) {
    issues.push({
      code: ERROR_CODES.GOLD_DATA_MISSING,
      category: "gold",
      targetId: target.abilityId,
      message: `金特「${displayName}」の実測データが1件もありません。gold_abilities.csv に実測値を追加してください。`,
    });
    return { item: null, issues };
  }

  const detail = `コツLv${target.hintLevel}`;
  const exact = rows.find((r) => r.hintLevel === target.hintLevel);
  if (exact) {
    return {
      item: {
        category: "gold",
        id: target.abilityId,
        displayName,
        detail,
        cost: exact.cost,
        source: "measured",
        autoAdded: false,
      },
      issues,
    };
  }

  const estimation = estimateGoldCost(
    rows,
    target.hintLevel,
    gameData.hintRules,
    gameData.config.goldEstimateSearchMax,
  );
  return {
    item: {
      category: "gold",
      id: target.abilityId,
      displayName,
      detail,
      cost: estimation.cost,
      source: estimation.confidence,
      autoAdded: false,
    },
    issues,
  };
}
