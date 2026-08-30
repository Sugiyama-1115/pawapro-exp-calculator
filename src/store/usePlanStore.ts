/**
 * 編集中プランの保持と自動保存（02_architecture.md §6 / 06_persistence_spec.md §3）。
 * 計算式は持たない。プランの形を変える操作のみを扱う。
 */
import { create } from "zustand";
import { getAppState, setAppState } from "@/data/persistence/db";
import { createPlanId, getPlan, savePlan } from "@/data/persistence/planRepository";
import { AppError } from "@/domain/errors/appError";
import type { PlayerPlan } from "@/domain/models/plan";

// ui 層は store のみに依存する（02_architecture.md §1）。
export type { PlayerPlan } from "@/domain/models/plan";

/** プラン編集からの自動保存待ち時間（06_persistence_spec.md §3）。 */
export const AUTOSAVE_DELAY_MS = 500;

export const DEFAULT_PLAN_NAME = "新規プラン";
export const PLAN_NAME_MIN_LENGTH = 1;
export const PLAN_NAME_MAX_LENGTH = 50;

interface PlanState {
  plan: PlayerPlan | null;
  dirty: boolean;
  storageWarning: string | null;

  bootstrap(gameId: string): Promise<void>;
  newPlan(gameId: string): void;
  openPlan(id: string): Promise<void>;
  setPlan(plan: PlayerPlan): void;
  updatePlan(patch: Partial<PlayerPlan>): void;
  changeGame(gameId: string): void;
  changePlayerType(playerType: PlayerPlan["playerType"]): void;
  save(): Promise<void>;
  dismissWarning(): void;
}

/** 既定値のプラン（05_ui_spec.md §3・§8）。センス○は「あり」を既定とする。 */
export function createEmptyPlan(
  gameId: string,
  id: string = createPlanId(),
  now: string = new Date().toISOString(),
): PlayerPlan {
  return {
    id,
    name: DEFAULT_PLAN_NAME,
    gameId,
    playerType: "pitcher",
    senseMode: "sense_plus",
    currentBase: {},
    targetBase: {},
    blueTargets: [],
    goldTargets: [],
    breakingPlan: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 選手種別の変更で無効になる入力を落とす（05_ui_spec.md §3.2）。
 * ゲーム変更では入力を消さない（計算時にデータ不足として報告する）。
 */
export function clearTypeDependentInput(plan: PlayerPlan): PlayerPlan {
  return {
    ...plan,
    currentBase: {},
    targetBase: {},
    blueTargets: [],
    goldTargets: [],
    breakingPlan: null,
  };
}

export function isValidPlanName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= PLAN_NAME_MIN_LENGTH && trimmed.length <= PLAN_NAME_MAX_LENGTH;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 保留中の自動保存を破棄する（テストおよびプラン切替時に使用）。 */
export function cancelPendingSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export const usePlanStore = create<PlanState>((set, get) => {
  function scheduleSave(): void {
    cancelPendingSave();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void get().save();
    }, AUTOSAVE_DELAY_MS);
  }

  function mutate(mutator: (plan: PlayerPlan) => PlayerPlan): void {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: mutator(plan), dirty: true });
    scheduleSave();
  }

  /** 保存の失敗で入力を止めないためのラッパ（06_persistence_spec.md §3）。 */
  async function guard<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      set({ storageWarning: error instanceof AppError ? error.message : String(error) });
      return fallback;
    }
  }

  function rememberPlanId(id: string): void {
    void guard(() => setAppState("lastPlanId", id), undefined);
  }

  return {
    plan: null,
    dirty: false,
    storageWarning: null,

    /** 前回開いていたプランを復元する。無ければ新規プランを作る（FR-P-05）。 */
    async bootstrap(gameId: string): Promise<void> {
      if (get().plan) return;
      const lastPlanId = await guard(() => getAppState<string>("lastPlanId"), null);
      if (lastPlanId !== null) {
        const plan = await guard(() => getPlan(lastPlanId), null);
        if (plan) {
          cancelPendingSave();
          set({ plan, dirty: false });
          return;
        }
      }
      get().newPlan(gameId);
    },

    newPlan(gameId: string): void {
      cancelPendingSave();
      const plan = createEmptyPlan(gameId);
      set({ plan, dirty: true });
      rememberPlanId(plan.id);
      scheduleSave();
    },

    async openPlan(id: string): Promise<void> {
      cancelPendingSave();
      const plan = await guard(() => getPlan(id), null);
      if (plan) {
        set({ plan, dirty: false });
        rememberPlanId(plan.id);
      }
    },

    setPlan(plan: PlayerPlan): void {
      cancelPendingSave();
      set({ plan, dirty: false });
      rememberPlanId(plan.id);
    },

    updatePlan(patch: Partial<PlayerPlan>): void {
      mutate((plan) => ({ ...plan, ...patch }));
    },

    changeGame(gameId: string): void {
      mutate((plan) => ({ ...plan, gameId }));
    },

    changePlayerType(playerType: PlayerPlan["playerType"]): void {
      mutate((plan) =>
        plan.playerType === playerType ? plan : clearTypeDependentInput({ ...plan, playerType }),
      );
    },

    async save(): Promise<void> {
      const plan = get().plan;
      if (!plan) return;
      // 保存に失敗しても入力内容は破棄しない（06_persistence_spec.md §3）
      const saved = await guard(() => savePlan(plan), null);
      if (!saved) return;
      // 保存中に編集された場合は updatedAt のみを取り込み、入力内容は上書きしない
      const current = get().plan;
      if (current && current.id === saved.id) {
        set({ plan: { ...current, updatedAt: saved.updatedAt }, dirty: false });
      }
    },

    dismissWarning(): void {
      set({ storageWarning: null });
    },
  };
});
