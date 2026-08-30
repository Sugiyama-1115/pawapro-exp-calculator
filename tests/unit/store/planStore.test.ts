/**
 * UT-ST-PLAN: 編集中プランのストア（06_persistence_spec.md §3 / 05_ui_spec.md §3.2）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { PlayerPlan } from "@/domain/models/plan";

const getPlan = vi.fn();
const savePlan = vi.fn();
const getAppState = vi.fn();
const setAppState = vi.fn();

vi.mock("@/data/persistence/planRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/planRepository")>();
  return {
    ...actual,
    getPlan: (...args: unknown[]) => getPlan(...args) as unknown,
    savePlan: (...args: unknown[]) => savePlan(...args) as unknown,
  };
});

vi.mock("@/data/persistence/db", () => ({
  getAppState: (...args: unknown[]) => getAppState(...args) as unknown,
  setAppState: (...args: unknown[]) => setAppState(...args) as unknown,
}));

const {
  AUTOSAVE_DELAY_MS,
  cancelPendingSave,
  clearTypeDependentInput,
  createEmptyPlan,
  isValidPlanName,
  usePlanStore,
} = await import("@/store/usePlanStore");

function filledPlan(): PlayerPlan {
  return {
    ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
    currentBase: { velocity: 130 },
    targetBase: { velocity: 140 },
    blueTargets: [{ abilityId: "strikeout", currentState: "NONE", targetState: "ON", hintLevel: 0 }],
    goldTargets: [{ abilityId: "doctor_k", hintLevel: 1, lowerAbilityHintLevel: 0 }],
    breakingPlan: { composition: [], mode: "none", aggregate: null, steps: [] },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  getPlan.mockResolvedValue(null);
  savePlan.mockImplementation((plan: PlayerPlan) =>
    Promise.resolve({ ...plan, updatedAt: "2026-08-31T12:00:00.000Z" }),
  );
  getAppState.mockResolvedValue(null);
  setAppState.mockResolvedValue(undefined);
  cancelPendingSave();
  usePlanStore.setState({ plan: null, dirty: false, storageWarning: null });
});

afterEach(() => {
  cancelPendingSave();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("usePlanStore", () => {
  it("UT-ST-PLAN-01: 新規プランの既定値は 投手 / センス○あり / 新規プラン", () => {
    const plan = createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z");
    expect(plan.name).toBe("新規プラン");
    expect(plan.playerType).toBe("pitcher");
    expect(plan.senseMode).toBe("sense_plus");
    expect(plan.breakingPlan).toBeNull();
  });

  it("UT-ST-PLAN-02: 編集から 500ms 後に自動保存される", async () => {
    usePlanStore.getState().setPlan(filledPlan());

    usePlanStore.getState().updatePlan({ name: "エース候補A" });
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(savePlan).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(usePlanStore.getState().dirty).toBe(false);
    expect(usePlanStore.getState().plan?.updatedAt).toBe("2026-08-31T12:00:00.000Z");
  });

  it("UT-ST-PLAN-03: 連続編集ではデバウンスされ保存は1回だけになる", async () => {
    usePlanStore.getState().setPlan(filledPlan());

    usePlanStore.getState().updatePlan({ name: "A" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    usePlanStore.getState().updatePlan({ name: "AB" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(usePlanStore.getState().plan?.name).toBe("AB");
  });

  it("UT-ST-PLAN-04: 選手種別の変更で種別依存の入力がクリアされる", () => {
    usePlanStore.getState().setPlan(filledPlan());

    usePlanStore.getState().changePlayerType("fielder");

    const plan = usePlanStore.getState().plan;
    expect(plan?.playerType).toBe("fielder");
    expect(plan?.currentBase).toEqual({});
    expect(plan?.targetBase).toEqual({});
    expect(plan?.blueTargets).toEqual([]);
    expect(plan?.goldTargets).toEqual([]);
    expect(plan?.breakingPlan).toBeNull();
  });

  it("UT-ST-PLAN-05: 同一種別への変更では入力を消さない", () => {
    const plan = filledPlan();
    usePlanStore.getState().setPlan(plan);

    usePlanStore.getState().changePlayerType("pitcher");

    expect(usePlanStore.getState().plan?.targetBase).toEqual({ velocity: 140 });
  });

  it("UT-ST-PLAN-06: ゲーム変更では入力内容をクリアしない", () => {
    usePlanStore.getState().setPlan(filledPlan());

    usePlanStore.getState().changeGame("pawapro2024");

    const plan = usePlanStore.getState().plan;
    expect(plan?.gameId).toBe("pawapro2024");
    expect(plan?.blueTargets).toHaveLength(1);
  });

  it("UT-ST-PLAN-07: 保存に失敗しても入力は破棄せず警告を残す", async () => {
    usePlanStore.getState().setPlan(filledPlan());
    savePlan.mockRejectedValue(
      new AppError(
        ERROR_CODES.STORAGE_ERROR,
        "保存に失敗しました。ブラウザの保存容量が不足している可能性があります。入力内容は画面上に保持されています。",
      ),
    );

    usePlanStore.getState().updatePlan({ name: "保存できない名前" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    const state = usePlanStore.getState();
    expect(state.plan?.name).toBe("保存できない名前");
    expect(state.storageWarning).toContain("保存に失敗しました");
  });

  it("UT-ST-PLAN-08: 前回開いていたプランを復元する", async () => {
    const stored = filledPlan();
    getAppState.mockResolvedValue("plan-1");
    getPlan.mockResolvedValue(stored);

    await usePlanStore.getState().bootstrap("sample2024");

    expect(usePlanStore.getState().plan).toEqual(stored);
    expect(usePlanStore.getState().dirty).toBe(false);
  });

  it("UT-ST-PLAN-09: 復元できないときは新規プランを作る", async () => {
    getAppState.mockResolvedValue("missing");
    getPlan.mockResolvedValue(null);

    await usePlanStore.getState().bootstrap("sample2024");

    expect(usePlanStore.getState().plan?.name).toBe("新規プラン");
    expect(usePlanStore.getState().plan?.gameId).toBe("sample2024");
  });

  it("UT-ST-PLAN-10: 選手名の妥当性判定は1〜50文字（前後空白はトリム）", () => {
    expect(isValidPlanName("A")).toBe(true);
    expect(isValidPlanName("  ")).toBe(false);
    expect(isValidPlanName("")).toBe(false);
    expect(isValidPlanName("あ".repeat(50))).toBe(true);
    expect(isValidPlanName("あ".repeat(51))).toBe(false);
  });

  it("UT-ST-PLAN-11: clearTypeDependentInput は名前・ゲーム・センス設定を保持する", () => {
    const cleared = clearTypeDependentInput(filledPlan());
    expect(cleared.name).toBe("新規プラン");
    expect(cleared.gameId).toBe("sample2024");
    expect(cleared.senseMode).toBe("sense_plus");
  });
});
