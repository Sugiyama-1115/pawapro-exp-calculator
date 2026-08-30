/**
 * 保存済みプランの一覧（02_architecture.md §6）。
 * 並び順は updatedAt 降順（05_ui_spec.md §8）で、data 層の返却順をそのまま用いる。
 */
import { create } from "zustand";
import type { PlanSummary } from "@/data/persistence/planRepository";
import {
  deletePlan,
  duplicatePlan,
  listPlanSummaries,
  toStoredPlan,
  toSummary,
} from "@/data/persistence/planRepository";
import { AppError } from "@/domain/errors/appError";

interface PlanListState {
  plans: PlanSummary[];
  loading: boolean;
  storageWarning: string | null;

  refresh(): Promise<void>;
  duplicate(id: string): Promise<PlanSummary | null>;
  remove(id: string): Promise<void>;
  dismissWarning(): void;
}

export const usePlanListStore = create<PlanListState>((set, get) => {
  async function guard<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      set({ storageWarning: error instanceof AppError ? error.message : String(error) });
      return fallback;
    }
  }

  return {
    plans: [],
    loading: false,
    storageWarning: null,

    async refresh(): Promise<void> {
      set({ loading: true });
      const plans = await guard(() => listPlanSummaries(), []);
      set({ plans, loading: false });
    },

    async duplicate(id: string): Promise<PlanSummary | null> {
      const copy = await guard(() => duplicatePlan(id), null);
      await get().refresh();
      return copy === null ? null : toSummary(toStoredPlan(copy));
    },

    async remove(id: string): Promise<void> {
      await guard(() => deletePlan(id), undefined);
      await get().refresh();
    },

    dismissWarning(): void {
      set({ storageWarning: null });
    },
  };
});
