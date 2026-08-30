import { ERROR_CODES } from "../errors/errorCodes";
import { breakingKey } from "../keys";
import type { SenseMode } from "../models/ability";
import type { ExpVector } from "../models/expVector";
import { EXP_KEYS } from "../models/expVector";
import type { GameDataSet } from "../models/gameData";
import type { BreakingPlan, BreakingStep } from "../models/plan";
import type { CalculationIssue, CalculationItem } from "../models/result";

export interface BreakingCalculationOutcome {
  items: CalculationItem[];
  issues: CalculationIssue[];
}

/**
 * 変化球の必要経験点（04_calculation_spec.md §7）。
 * 実測・入力値のみを使い、推定・近似・補間は一切行わない。
 */
export function calculateBreaking(
  gameData: GameDataSet,
  senseMode: SenseMode,
  plan: BreakingPlan | null,
): BreakingCalculationOutcome {
  const items: CalculationItem[] = [];
  const issues: CalculationIssue[] = [];

  if (plan === null) {
    return { items, issues };
  }

  if (plan.mode === "aggregate") {
    if (isCompleteVector(plan.aggregate)) {
      items.push({
        category: "breaking",
        id: "aggregate",
        displayName: "変化球（一括）",
        detail: describeComposition(plan),
        cost: plan.aggregate,
        source: "manual",
        autoAdded: false,
      });
    } else {
      issues.push({
        code: ERROR_CODES.BREAKING_DATA_MISSING,
        category: "breaking",
        targetId: "aggregate",
        message: "変化球経験点が未入力です。",
      });
    }
    return { items, issues };
  }

  if (plan.mode === "step") {
    const steps = [...plan.steps].sort((a, b) => a.seq - b.seq);
    if (steps.length === 0 && plan.composition.length > 0) {
      issues.push({
        code: ERROR_CODES.BREAKING_DATA_MISSING,
        category: "breaking",
        targetId: "steps",
        message: "変化球経験点が未入力です。",
      });
      return { items, issues };
    }
    const cache = senseMode === "sense_plus" ? gameData.breakingSensePlus : gameData.breakingNormal;
    for (const step of steps) {
      if (isCompleteVector(step.cost)) {
        items.push(buildStepItem(step, step.cost, "manual"));
        continue;
      }
      // 完全一致のみ。近似・補間で埋めると推定禁止の規定に反する
      const cached = cache.get(
        breakingKey(step.pitchType, step.fromLevel, step.totalBreakBefore, step.pitchCountBefore),
      );
      if (cached) {
        items.push(buildStepItem(step, cached.cost, "measured"));
        continue;
      }
      issues.push({
        code: ERROR_CODES.BREAKING_DATA_MISSING,
        category: "breaking",
        targetId: `${step.seq}`,
        message: `変化球ステップ ${step.seq}（${step.pitchType} ${step.fromLevel}→${step.toLevel}）の経験点が未登録です。入力するか共通キャッシュに登録してください。`,
      });
    }
    return { items, issues };
  }

  if (plan.composition.length > 0) {
    issues.push({
      code: ERROR_CODES.BREAKING_DATA_MISSING,
      category: "breaking",
      targetId: "composition",
      message: "変化球経験点が未入力です。",
    });
  }
  return { items, issues };
}

function buildStepItem(
  step: BreakingStep,
  cost: ExpVector,
  source: "manual" | "measured",
): CalculationItem {
  return {
    category: "breaking",
    id: `step-${step.seq}`,
    displayName: step.pitchType,
    detail: `${step.fromLevel} → ${step.toLevel}`,
    cost,
    source,
    autoAdded: false,
  };
}

function describeComposition(plan: BreakingPlan): string {
  if (plan.composition.length === 0) {
    return "一括入力";
  }
  return plan.composition.map((c) => `${c.pitchType}${c.level}`).join(" / ");
}

function isCompleteVector(value: ExpVector | null): value is ExpVector {
  if (value === null) {
    return false;
  }
  return EXP_KEYS.every((k) => Number.isFinite(value[k]));
}
