import type { ExpVector } from "./expVector";

export type ItemCategory = "base" | "blue" | "gold" | "breaking";
export type ItemSource = "master" | "measured" | "estimated" | "estimated_high" | "manual";
export type ResultStatus = "confirmed" | "estimated" | "incomplete";

export const ITEM_CATEGORIES = ["base", "blue", "gold", "breaking"] as const;

export interface CalculationItem {
  category: ItemCategory;
  id: string;
  displayName: string;
  detail: string;
  cost: ExpVector;
  source: ItemSource;
  autoAdded: boolean;
}

export interface CalculationIssue {
  code: string;
  category: ItemCategory | "load";
  targetId: string;
  message: string;
}

export interface CalculationResult {
  total: ExpVector;
  subtotal: Record<ItemCategory, ExpVector>;
  base: CalculationItem[];
  blue: CalculationItem[];
  gold: CalculationItem[];
  breaking: CalculationItem[];
  status: ResultStatus;
  issues: CalculationIssue[];
}
