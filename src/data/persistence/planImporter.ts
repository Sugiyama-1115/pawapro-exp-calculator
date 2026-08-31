/**
 * プランJSONの読み込み（06_persistence_spec.md §5.2）。
 * 外部ファイルは unknown として受け取り、本関数で PlayerPlan に確定させる。
 * 形式が一致しない・内容が壊れている場合は一切採用しない。
 */
import type { BlueTarget, BreakingPlan, BreakingStep, PlayerPlan } from "@/domain/models/plan";
import type { GoldTarget } from "@/domain/models/plan";
import type { ExpVector } from "@/domain/models/expVector";
import { EXP_KEYS } from "@/domain/models/expVector";
import { PLAN_EXPORT_FORMAT, PLAN_EXPORT_FORMAT_VERSION } from "./exporter";

export const PLAN_IMPORT_NOT_JSON = "ファイルをJSONとして読み取れませんでした。";
export const PLAN_IMPORT_WRONG_FORMAT = "このファイルは本アプリのプランJSONではありません。";
export const PLAN_IMPORT_UNSUPPORTED_VERSION =
  "このプランJSONの形式バージョンには対応していません。";
export const PLAN_IMPORT_BROKEN_PLAN = "プランの内容が壊れているため読み込めませんでした。";

export type PlanImportResult = { ok: true; plan: PlayerPlan } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) return null;
    result[key] = entry;
  }
  return result;
}

function expVector(value: unknown): ExpVector | null {
  if (!isRecord(value)) return null;
  const vector: Partial<ExpVector> = {};
  for (const key of EXP_KEYS) {
    const entry = int(value[key]);
    if (entry === null) return null;
    vector[key] = entry;
  }
  return vector as ExpVector;
}

function blueTargets(value: unknown): BlueTarget[] | null {
  if (!Array.isArray(value)) return null;
  const result: BlueTarget[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const abilityId = str(entry.abilityId);
    const currentState = str(entry.currentState);
    const targetState = str(entry.targetState);
    const hintLevel = int(entry.hintLevel);
    if (abilityId === null || currentState === null || targetState === null || hintLevel === null) {
      return null;
    }
    result.push({ abilityId, currentState, targetState, hintLevel });
  }
  return result;
}

function goldTargets(value: unknown): GoldTarget[] | null {
  if (!Array.isArray(value)) return null;
  const result: GoldTarget[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const abilityId = str(entry.abilityId);
    const hintLevel = int(entry.hintLevel);
    const lowerAbilityHintLevel = int(entry.lowerAbilityHintLevel);
    if (abilityId === null || hintLevel === null || lowerAbilityHintLevel === null) return null;
    result.push({ abilityId, hintLevel, lowerAbilityHintLevel });
  }
  return result;
}

function breakingSteps(value: unknown): BreakingStep[] | null {
  if (!Array.isArray(value)) return null;
  const result: BreakingStep[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const seq = int(entry.seq);
    const pitchType = str(entry.pitchType);
    const fromLevel = int(entry.fromLevel);
    const toLevel = int(entry.toLevel);
    const totalBreakBefore = int(entry.totalBreakBefore);
    const pitchCountBefore = int(entry.pitchCountBefore);
    if (
      seq === null ||
      pitchType === null ||
      fromLevel === null ||
      toLevel === null ||
      totalBreakBefore === null ||
      pitchCountBefore === null
    ) {
      return null;
    }
    const cost = entry.cost === null ? null : expVector(entry.cost);
    if (entry.cost !== null && cost === null) return null;
    result.push({
      seq,
      pitchType,
      fromLevel,
      toLevel,
      totalBreakBefore,
      pitchCountBefore,
      cost,
    });
  }
  return result;
}

function breakingPlan(value: unknown): BreakingPlan | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return "invalid";
  const mode = str(value.mode);
  if (mode !== "aggregate" && mode !== "step" && mode !== "none") return "invalid";
  if (!Array.isArray(value.composition)) return "invalid";
  const composition: BreakingPlan["composition"] = [];
  for (const entry of value.composition) {
    if (!isRecord(entry)) return "invalid";
    const pitchType = str(entry.pitchType);
    const level = int(entry.level);
    if (pitchType === null || level === null) return "invalid";
    composition.push({ pitchType, level });
  }
  const aggregate = value.aggregate === null ? null : expVector(value.aggregate);
  if (value.aggregate !== null && aggregate === null) return "invalid";
  const steps = breakingSteps(value.steps);
  if (steps === null) return "invalid";
  return { composition, mode, aggregate, steps };
}

/** ラッパを検証し、中身の PlayerPlan を確定させる。id の衝突回避は呼び出し側が行う。 */
export function parsePlanJson(text: string): PlanImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, message: PLAN_IMPORT_NOT_JSON };
  }

  if (!isRecord(parsed) || parsed.format !== PLAN_EXPORT_FORMAT) {
    return { ok: false, message: PLAN_IMPORT_WRONG_FORMAT };
  }
  if (parsed.formatVersion !== PLAN_EXPORT_FORMAT_VERSION) {
    return { ok: false, message: PLAN_IMPORT_UNSUPPORTED_VERSION };
  }

  const source = parsed.plan;
  if (!isRecord(source)) return { ok: false, message: PLAN_IMPORT_BROKEN_PLAN };

  const id = str(source.id);
  const name = str(source.name);
  const gameId = str(source.gameId);
  const playerType = str(source.playerType);
  const senseMode = str(source.senseMode);
  const currentBase = numberRecord(source.currentBase);
  const targetBase = numberRecord(source.targetBase);
  const blue = blueTargets(source.blueTargets);
  const gold = goldTargets(source.goldTargets);
  const breaking = breakingPlan(source.breakingPlan);
  const createdAt = str(source.createdAt);
  const updatedAt = str(source.updatedAt);

  if (
    id === null ||
    name === null ||
    gameId === null ||
    (playerType !== "pitcher" && playerType !== "fielder") ||
    (senseMode !== "normal" && senseMode !== "sense_plus") ||
    currentBase === null ||
    targetBase === null ||
    blue === null ||
    gold === null ||
    breaking === "invalid" ||
    createdAt === null ||
    updatedAt === null
  ) {
    return { ok: false, message: PLAN_IMPORT_BROKEN_PLAN };
  }

  return {
    ok: true,
    plan: {
      id,
      name,
      gameId,
      playerType,
      senseMode,
      currentBase,
      targetBase,
      blueTargets: blue,
      goldTargets: gold,
      breakingPlan: breaking,
      createdAt,
      updatedAt,
    },
  };
}
