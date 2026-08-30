import { ERROR_CODES } from "../errors/errorCodes";
import { blueKey, hintKey } from "../keys";
import type { BlueAbilityMeta, BlueAbilityRow, SenseMode } from "../models/ability";
import type { ExpVector } from "../models/expVector";
import { EXP_KEYS, addVector, sumVectors, zeroVector } from "../models/expVector";
import type { GameDataSet } from "../models/gameData";
import type { BlueTarget } from "../models/plan";
import type { CalculationIssue, CalculationItem, ItemSource } from "../models/result";
import { applyRounding } from "../rounding";

export interface BlueCalculationOutcome {
  item: CalculationItem | null;
  issues: CalculationIssue[];
}

/**
 * 青特の必要経験点（04_calculation_spec.md §4）。
 * プランの playerType は使わず、能力自身のマスタ上の player_type で行を解決する（FR-BL-09）。
 */
export function calculateBlueAbility(
  gameData: GameDataSet,
  senseMode: SenseMode,
  target: BlueTarget,
): BlueCalculationOutcome {
  const issues: CalculationIssue[] = [];
  const meta = gameData.blueIndex.get(target.abilityId);
  if (!meta) {
    issues.push({
      code: ERROR_CODES.BLUE_DATA_MISSING,
      category: "blue",
      targetId: target.abilityId,
      message: `青特「${target.abilityId}」が blue_abilities.csv に登録されていません。`,
    });
    return { item: null, issues };
  }

  const states = meta.states;
  const ci = states.indexOf(target.currentState);
  const ti = states.indexOf(target.targetState);
  if (ci < 0 || ti < 0) {
    const invalid = ci < 0 ? target.currentState : target.targetState;
    issues.push({
      code: ERROR_CODES.INVALID_TARGET,
      category: "blue",
      targetId: target.abilityId,
      message: `「${meta.displayName}」の状態「${invalid}」は不正です。`,
    });
    return { item: null, issues };
  }
  if (ti < ci) {
    issues.push({
      code: ERROR_CODES.INVALID_TARGET,
      category: "blue",
      targetId: target.abilityId,
      message: `${meta.displayName} の目標値は初期値以上にしてください。`,
    });
    return { item: null, issues };
  }
  if (ti === ci) {
    return { item: buildItem(meta, target, zeroVector(), "measured"), issues };
  }

  const lookup = (state: string, hintLevel: number, mode: SenseMode): BlueAbilityRow | undefined =>
    gameData.blue.get(blueKey(target.abilityId, meta.playerType, state, hintLevel, mode)) ??
    gameData.blue.get(blueKey(target.abilityId, "common", state, hintLevel, mode));

  // 実測パス: 区間内の全遷移が (hintLevel, senseMode) に完全一致する場合のみ成立させる。
  // 一部だけ実測を混ぜると丸め位置が実装依存になるため、混在は禁止（04 §4）。
  const exactRows: BlueAbilityRow[] = [];
  let exactComplete = true;
  for (let i = ci; i < ti; i++) {
    const state = states[i];
    const row = state === undefined ? undefined : lookup(state, target.hintLevel, senseMode);
    if (!row) {
      exactComplete = false;
      break;
    }
    exactRows.push(row);
  }
  if (exactComplete) {
    const cost = sumVectors(exactRows.map((r) => r.cost));
    return { item: buildItem(meta, target, cost, "measured"), issues };
  }

  // 基準行パス
  let baseSum = zeroVector();
  for (let i = ci; i < ti; i++) {
    const state = states[i];
    const row = state === undefined ? undefined : lookup(state, 0, "normal");
    if (!row) {
      issues.push({
        code: ERROR_CODES.BLUE_DATA_MISSING,
        category: "blue",
        targetId: target.abilityId,
        message: `青特「${meta.displayName}」の ${state ?? "?"}→${states[i + 1] ?? "?"} の経験点データがありません。blue_abilities.csv を確認してください。`,
      });
      return { item: null, issues };
    }
    baseSum = addVector(baseSum, row.cost);
  }

  const hint = gameData.hintRules.get(hintKey("blue", target.hintLevel));
  if (!hint) {
    issues.push({
      code: ERROR_CODES.INVALID_CSV,
      category: "blue",
      targetId: target.abilityId,
      message: `hint_rules.csv に blue のコツLv${target.hintLevel} の行がありません。`,
    });
    return { item: null, issues };
  }
  const senseMul =
    senseMode === "sense_plus"
      ? gameData.config.blueSensePlusMultiplier
      : gameData.config.blueNormalMultiplier;

  // 倍率の乗算を1回にまとめ、丸めは最後の1回だけ行う（段階ごとに丸めると二重丸めになる）
  const cost = zeroVector();
  for (const k of EXP_KEYS) {
    cost[k] = applyRounding(baseSum[k] * hint.multiplier * senseMul, hint.rounding);
  }
  return { item: buildItem(meta, target, cost, "master"), issues };
}

function buildItem(
  meta: BlueAbilityMeta,
  target: BlueTarget,
  cost: ExpVector,
  source: ItemSource,
): CalculationItem {
  return {
    category: "blue",
    id: meta.abilityId,
    displayName: meta.displayName,
    detail: `${target.currentState} → ${target.targetState} / コツLv${target.hintLevel}`,
    cost,
    source,
    autoAdded: false,
  };
}
