import { INCOMPLETE_CODES } from "../errors/errorCodes";
import { baseDefKey } from "../keys";
import { statesOf } from "../models/ability";
import type { ExpVector } from "../models/expVector";
import { addVector, sumVectors, zeroVector } from "../models/expVector";
import type { GameDataSet } from "../models/gameData";
import type { BlueTarget, PlayerPlan } from "../models/plan";
import type {
  CalculationIssue,
  CalculationItem,
  CalculationResult,
  ItemCategory,
  ResultStatus,
} from "../models/result";
import { calculateBaseAbility } from "./baseCalculator";
import { calculateBlueAbility } from "./blueCalculator";
import { calculateBreaking } from "./breakingCalculator";
import { calculateGoldAbility } from "./goldCalculator";

interface MergedBlue {
  target: BlueTarget;
  autoAdded: boolean;
  userOrder: number | null;
}

/** プラン全体の必要経験点（04_calculation_spec.md §8）。純粋関数であること。 */
export function calculatePlan(gameData: GameDataSet, plan: PlayerPlan): CalculationResult {
  const issues: CalculationIssue[] = [];

  const base = calculateBaseItems(gameData, plan, issues);
  const blue = calculateBlueItems(gameData, plan, issues);
  const gold = calculateGoldItems(gameData, plan, issues);
  const breaking = calculateBreakingItems(gameData, plan, issues);

  const subtotal: Record<ItemCategory, ExpVector> = {
    base: sumItems(base),
    blue: sumItems(blue),
    gold: sumItems(gold),
    breaking: sumItems(breaking),
  };
  const total = sumVectors([subtotal.base, subtotal.blue, subtotal.gold, subtotal.breaking]);

  return {
    total,
    subtotal,
    base,
    blue,
    gold,
    breaking,
    status: judgeStatus(issues, [...base, ...blue, ...gold, ...breaking]),
    issues,
  };
}

function calculateBaseItems(
  gameData: GameDataSet,
  plan: PlayerPlan,
  issues: CalculationIssue[],
): CalculationItem[] {
  const abilityIds = Object.keys(plan.targetBase).sort((a, b) => {
    const oa = gameData.baseDefs.get(baseDefKey(plan.playerType, a))?.displayOrder;
    const ob = gameData.baseDefs.get(baseDefKey(plan.playerType, b))?.displayOrder;
    if (oa !== ob) {
      return (oa ?? Number.MAX_SAFE_INTEGER) - (ob ?? Number.MAX_SAFE_INTEGER);
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const items: CalculationItem[] = [];
  for (const abilityId of abilityIds) {
    const targetValue = plan.targetBase[abilityId];
    if (targetValue === undefined) {
      continue;
    }
    // 初期値の入力が無い場合は「変化なし」として扱う。値を推測して経験点を作らないため。
    const currentValue = plan.currentBase[abilityId] ?? targetValue;
    const def = gameData.baseDefs.get(baseDefKey(plan.playerType, abilityId));
    const outcome = calculateBaseAbility(
      gameData,
      plan.playerType,
      plan.senseMode,
      abilityId,
      currentValue,
      targetValue,
    );
    issues.push(...outcome.issues);
    items.push({
      category: "base",
      id: abilityId,
      displayName: def?.displayName ?? abilityId,
      detail: `${currentValue} → ${targetValue}`,
      cost: outcome.cost,
      source: "master",
      autoAdded: false,
    });
  }
  return items;
}

function calculateBlueItems(
  gameData: GameDataSet,
  plan: PlayerPlan,
  issues: CalculationIssue[],
): CalculationItem[] {
  const merged = mergeBlueTargets(gameData, plan);
  const items: CalculationItem[] = [];
  for (const entry of merged) {
    const outcome = calculateBlueAbility(gameData, plan.senseMode, entry.target);
    issues.push(...outcome.issues);
    if (outcome.item) {
      items.push({ ...outcome.item, autoAdded: entry.autoAdded });
    }
  }
  return items;
}

/**
 * 青特の重複排除（04_calculation_spec.md §8.1）。
 * 同一 abilityId を二重計上することは重大な欠陥のため、必ず1件へ畳み込む。
 */
function mergeBlueTargets(gameData: GameDataSet, plan: PlayerPlan): MergedBlue[] {
  interface Draft {
    abilityId: string;
    currentState: string;
    targetState: string;
    userHintLevel: number | null;
    maxAutoHintLevel: number | null;
    autoAdded: boolean;
    userOrder: number | null;
  }

  const drafts = new Map<string, Draft>();

  const statesFor = (abilityId: string): string[] =>
    gameData.blueIndex.get(abilityId)?.states ?? [];

  const advanced = (abilityId: string, a: string, b: string): string => {
    const states = statesFor(abilityId);
    const ia = states.indexOf(a);
    const ib = states.indexOf(b);
    if (ia < 0 || ib < 0) {
      return ia < 0 ? b : a;
    }
    return ib > ia ? b : a;
  };

  plan.blueTargets.forEach((target, index) => {
    const existing = drafts.get(target.abilityId);
    if (!existing) {
      drafts.set(target.abilityId, {
        abilityId: target.abilityId,
        currentState: target.currentState,
        targetState: target.targetState,
        userHintLevel: target.hintLevel,
        maxAutoHintLevel: null,
        autoAdded: false,
        userOrder: index,
      });
      return;
    }
    existing.currentState = advanced(target.abilityId, existing.currentState, target.currentState);
    existing.targetState = advanced(target.abilityId, existing.targetState, target.targetState);
    existing.userHintLevel = existing.userHintLevel ?? target.hintLevel;
    existing.autoAdded = false;
  });

  for (const goldTarget of plan.goldTargets) {
    const prereqs = gameData.goldPrereq.get(goldTarget.abilityId) ?? [];
    for (const prereq of prereqs) {
      const existing = drafts.get(prereq.lowerBlueId);
      if (!existing) {
        const meta = gameData.blueIndex.get(prereq.lowerBlueId);
        const defaultCurrent = meta ? (statesOf(meta.abilityType)[0] ?? "NONE") : "NONE";
        drafts.set(prereq.lowerBlueId, {
          abilityId: prereq.lowerBlueId,
          currentState: defaultCurrent,
          targetState: prereq.requiredState,
          userHintLevel: null,
          maxAutoHintLevel: goldTarget.lowerAbilityHintLevel,
          autoAdded: true,
          userOrder: null,
        });
        continue;
      }
      existing.targetState = advanced(prereq.lowerBlueId, existing.targetState, prereq.requiredState);
      existing.maxAutoHintLevel =
        existing.maxAutoHintLevel === null
          ? goldTarget.lowerAbilityHintLevel
          : Math.max(existing.maxAutoHintLevel, goldTarget.lowerAbilityHintLevel);
    }
  }

  const merged: MergedBlue[] = [...drafts.values()].map((draft) => {
    const states = statesFor(draft.abilityId);
    const ci = states.indexOf(draft.currentState);
    const ti = states.indexOf(draft.targetState);
    // すでに目標状態以上を所持しているなら cost 0（原仕様 §25）
    const targetState = ci >= 0 && ti >= 0 && ci >= ti ? draft.currentState : draft.targetState;
    return {
      target: {
        abilityId: draft.abilityId,
        currentState: draft.currentState,
        targetState,
        hintLevel: draft.userHintLevel ?? draft.maxAutoHintLevel ?? 0,
      },
      autoAdded: draft.autoAdded,
      userOrder: draft.userOrder,
    };
  });

  const userSpecified = merged
    .filter((m) => m.userOrder !== null)
    .sort((a, b) => (a.userOrder ?? 0) - (b.userOrder ?? 0));
  const autoOnly = merged
    .filter((m) => m.userOrder === null)
    .sort((a, b) =>
      a.target.abilityId < b.target.abilityId ? -1 : a.target.abilityId > b.target.abilityId ? 1 : 0,
    );
  return [...userSpecified, ...autoOnly];
}

function calculateGoldItems(
  gameData: GameDataSet,
  plan: PlayerPlan,
  issues: CalculationIssue[],
): CalculationItem[] {
  const items: CalculationItem[] = [];
  for (const target of plan.goldTargets) {
    const outcome = calculateGoldAbility(gameData, plan.senseMode, target);
    issues.push(...outcome.issues);
    if (outcome.item) {
      items.push(outcome.item);
    }
  }
  return items;
}

function calculateBreakingItems(
  gameData: GameDataSet,
  plan: PlayerPlan,
  issues: CalculationIssue[],
): CalculationItem[] {
  // 野手プランは変化球を持たないため計算対象外（04 §7）
  if (plan.playerType === "fielder") {
    return [];
  }
  const outcome = calculateBreaking(gameData, plan.senseMode, plan.breakingPlan);
  issues.push(...outcome.issues);
  return outcome.items;
}

function sumItems(items: CalculationItem[]): ExpVector {
  return items.reduce<ExpVector>((acc, item) => addVector(acc, item.cost), zeroVector());
}

function judgeStatus(issues: CalculationIssue[], items: CalculationItem[]): ResultStatus {
  if (issues.some((issue) => INCOMPLETE_CODES.has(issue.code))) {
    return "incomplete";
  }
  if (items.some((item) => item.source === "estimated" || item.source === "estimated_high")) {
    return "estimated";
  }
  return "confirmed";
}
