import type { SenseMode } from "./ability";
import type { ExpVector } from "./expVector";

export interface BlueTarget {
  abilityId: string;
  currentState: string;
  targetState: string;
  hintLevel: number;
}

export interface GoldTarget {
  abilityId: string;
  hintLevel: number;
  lowerAbilityHintLevel: number;
}

export interface BreakingComposition {
  pitchType: string;
  level: number;
}

export interface BreakingStep {
  seq: number;
  pitchType: string;
  fromLevel: number;
  toLevel: number;
  totalBreakBefore: number;
  pitchCountBefore: number;
  cost: ExpVector | null;
}

export interface BreakingPlan {
  composition: BreakingComposition[];
  mode: "aggregate" | "step" | "none";
  aggregate: ExpVector | null;
  steps: BreakingStep[];
}

export interface PlayerPlan {
  id: string;
  name: string;
  gameId: string;
  playerType: "pitcher" | "fielder";
  senseMode: SenseMode;

  currentBase: Record<string, number>;
  targetBase: Record<string, number>;

  blueTargets: BlueTarget[];
  goldTargets: GoldTarget[];

  breakingPlan: BreakingPlan | null;

  createdAt: string;
  updatedAt: string;
}
