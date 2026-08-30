import type { ExpVector } from "./expVector";

export type PlayerType = "pitcher" | "fielder" | "common";
export type SenseMode = "normal" | "sense_plus";
export type AbilityType = "binary" | "rank";

export const BINARY_STATES = ["NONE", "ON"] as const;
export const RANK_STATES = ["G", "F", "E", "D", "C", "B", "A"] as const;

export type RoundingMode = "floor" | "round" | "ceil";

export interface BaseAbilityDef {
  abilityId: string;
  displayName: string;
  playerType: Exclude<PlayerType, "common">;
  minValue: number;
  maxValue: number;
  displayOrder: number;
  valueType: "numeric" | "trajectory";
}

export interface BaseCostRow {
  playerType: PlayerType;
  abilityId: string;
  fromValue: number;
  toValue: number;
  cost: ExpVector;
}

export interface BlueAbilityRow {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  abilityType: AbilityType;
  fromState: string;
  toState: string;
  hintLevel: number;
  senseMode: SenseMode;
  cost: ExpVector;
}

export interface GoldAbilityRow {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  hintLevel: number;
  senseMode: SenseMode;
  cost: ExpVector;
}

export interface BlueAbilityMeta {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  abilityType: AbilityType;
  states: string[];
}

export interface GoldAbilityMeta {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
}

export interface GoldPrerequisite {
  goldId: string;
  lowerBlueId: string;
  requiredState: string;
}

export interface HintRule {
  abilityType: "blue" | "gold";
  hintLevel: number;
  multiplier: number;
  rounding: RoundingMode;
}

export interface BreakingCacheRow {
  pitchType: string;
  fromLevel: number;
  toLevel: number;
  totalBreakBefore: number;
  pitchCountBefore: number;
  cost: ExpVector;
}

export function statesOf(abilityType: AbilityType): string[] {
  return abilityType === "binary" ? [...BINARY_STATES] : [...RANK_STATES];
}
