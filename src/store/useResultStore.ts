/**
 * 計算結果（派生状態）。02_architecture.md §2 のとおり
 * ゲームデータ・プランの変更を購読し 200ms デバウンスで再計算する。
 * 計算そのものは domain の純粋関数 calculatePlan が行う。
 */
import { create } from "zustand";
import { calculatePlan } from "@/domain/calculator/planCalculator";
import type { CalculationResult } from "@/domain/models/result";
import { useGameDataStore } from "./useGameDataStore";
import { usePlanStore } from "./usePlanStore";

/** 再計算のデバウンス時間（02_architecture.md §2）。 */
export const RECALC_DEBOUNCE_MS = 200;

interface ResultState {
  result: CalculationResult | null;
  calculating: boolean;
  recalculate(): void;
}

export const useResultStore = create<ResultState>((set) => ({
  result: null,
  calculating: false,

  recalculate(): void {
    const { gameData } = useGameDataStore.getState();
    const { plan } = usePlanStore.getState();
    if (!gameData || !plan) {
      set({ result: null, calculating: false });
      return;
    }
    set({ result: calculatePlan(gameData, plan), calculating: false });
  },
}));

/**
 * 再計算の購読を開始する。戻り値を呼ぶと購読を解除する。
 * 呼び出しは UI 側の1箇所（App）に限定し、購読の多重化を避ける。
 */
export function startResultSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const trigger = (): void => {
    useResultStore.setState({ calculating: true });
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      useResultStore.getState().recalculate();
    }, RECALC_DEBOUNCE_MS);
  };

  const unsubscribeGameData = useGameDataStore.subscribe((state, previous) => {
    if (state.gameData !== previous.gameData) trigger();
  });
  const unsubscribePlan = usePlanStore.subscribe((state, previous) => {
    if (state.plan !== previous.plan) trigger();
  });

  trigger();

  return (): void => {
    if (timer !== null) clearTimeout(timer);
    unsubscribeGameData();
    unsubscribePlan();
  };
}
