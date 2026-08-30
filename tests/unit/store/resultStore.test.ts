/**
 * UT-ST-RESULT: 結果ストア（02_architecture.md §2）。
 * 200ms デバウンスで再計算が走ること、計算式がストアに無いことを確認する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameDataStore } from "@/store/useGameDataStore";
import { usePlanStore } from "@/store/usePlanStore";
import { RECALC_DEBOUNCE_MS, startResultSync, useResultStore } from "@/store/useResultStore";
import { createEmptyPlan } from "@/store/usePlanStore";
import type { PlayerPlan } from "@/domain/models/plan";
import { createSampleGameData } from "../../fixtures/sampleGameData";

/** E2E-01（13_e2e_test_spec.md §4）と同じ入力。期待値も同章の確定値を使う。 */
function e2e01Plan(): PlayerPlan {
  return {
    ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
    currentBase: { velocity: 130, control: 40 },
    targetBase: { velocity: 133, control: 41 },
  };
}

let stopSync: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  useResultStore.setState({ result: null, calculating: false });
  useGameDataStore.setState({ gameData: createSampleGameData() });
  usePlanStore.setState({ plan: null, dirty: false, storageWarning: null });
});

afterEach(() => {
  stopSync?.();
  stopSync = null;
  vi.useRealTimers();
});

describe("useResultStore", () => {
  it("UT-ST-RESULT-01: プランが無いあいだは結果を持たない", () => {
    stopSync = startResultSync();
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    expect(useResultStore.getState().result).toBeNull();
  });

  it("UT-ST-RESULT-02: 入力変更から 200ms 後に再計算される", () => {
    stopSync = startResultSync();
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    usePlanStore.setState({ plan: e2e01Plan() });
    expect(useResultStore.getState().calculating).toBe(true);
    expect(useResultStore.getState().result).toBeNull();

    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    const result = useResultStore.getState().result;
    expect(useResultStore.getState().calculating).toBe(false);
    expect(result?.total).toEqual({
      muscle: 32,
      agility: 0,
      technique: 20,
      breaking: 0,
      mental: 3,
    });
    expect(result?.status).toBe("confirmed");
  });

  it("UT-ST-RESULT-03: 連続変更はデバウンスされ最後の入力で計算される", () => {
    stopSync = startResultSync();
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    usePlanStore.setState({ plan: e2e01Plan() });
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS - 50);
    usePlanStore.setState({
      plan: { ...e2e01Plan(), targetBase: { velocity: 130, control: 40 } },
    });
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    expect(useResultStore.getState().result?.total).toEqual({
      muscle: 0,
      agility: 0,
      technique: 0,
      breaking: 0,
      mental: 0,
    });
  });

  it("UT-ST-RESULT-04: ゲームデータの差し替えでも再計算される", () => {
    usePlanStore.setState({ plan: e2e01Plan() });
    stopSync = startResultSync();
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);
    expect(useResultStore.getState().result).not.toBeNull();

    useGameDataStore.setState({ gameData: null });
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    expect(useResultStore.getState().result).toBeNull();
  });

  it("UT-ST-RESULT-05: 購読を解除すると再計算されない", () => {
    stopSync = startResultSync();
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);
    stopSync();
    stopSync = null;

    usePlanStore.setState({ plan: e2e01Plan() });
    vi.advanceTimersByTime(RECALC_DEBOUNCE_MS);

    expect(useResultStore.getState().result).toBeNull();
  });
});
