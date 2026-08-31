/**
 * UI-T4 系の自動化分（05_ui_spec.md §6）。
 * 期待値は 11_unit_test_spec.md §1 の標準フィクスチャ（変化球キャッシュ）から導出した確定値。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BreakingPlan, PlayerPlan } from "@/domain/models/plan";
import { createSampleGameData } from "../../fixtures/sampleGameData";

const savePlan = vi.fn();
const saveBreakingCacheRows = vi.fn();

vi.mock("@/data/repositories/gameDataLoader", () => ({
  loadGamesManifest: () => Promise.resolve({ games: [], defaultGameId: "" }),
  loadGameData: () => Promise.resolve(createSampleGameData()),
}));

vi.mock("@/data/persistence/db", () => ({
  getAppState: () => Promise.resolve(null),
  setAppState: () => Promise.resolve(undefined),
}));

vi.mock("@/data/persistence/breakingCacheRepository", () => ({
  loadBreakingCacheEntries: () => Promise.resolve([]),
  saveBreakingCacheRows: (...args: unknown[]) => saveBreakingCacheRows(...args) as unknown,
}));

vi.mock("@/data/persistence/planRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/planRepository")>();
  return {
    ...actual,
    getPlan: () => Promise.resolve(null),
    savePlan: (...args: unknown[]) => savePlan(...args) as unknown,
  };
});

vi.mock("@/data/persistence/overrideRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/overrideRepository")>();
  return { ...actual, listOverrides: () => Promise.resolve([]) };
});

const { useGameDataStore } = await import("@/store/useGameDataStore");
const { cancelPendingSave, createEmptyPlan, usePlanStore } = await import("@/store/usePlanStore");
const { useResultStore } = await import("@/store/useResultStore");
const { BreakingBallTab, CACHE_OVERWRITE_CONFIRM, NOT_MEASURED_TITLE, STEP_UNREGISTERED_TEXT } =
  await import("@/ui/tabs/BreakingBallTab");

function setPlan(patch: Partial<PlayerPlan>): void {
  usePlanStore.setState({
    plan: { ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"), ...patch },
    dirty: false,
  });
}

function setBreaking(breakingPlan: BreakingPlan, patch: Partial<PlayerPlan> = {}): void {
  setPlan({ breakingPlan, ...patch });
}

function recalculate(): void {
  act(() => {
    useResultStore.getState().recalculate();
  });
}

function currentBreaking(): BreakingPlan | null {
  return usePlanStore.getState().plan?.breakingPlan ?? null;
}

/** 4キーがサンプルCSVの実測行と完全一致するステップ（slider 1→2 / 総変化1 / 球種数1）。 */
const CACHED_STEP = {
  seq: 1,
  pitchType: "slider",
  fromLevel: 1,
  toLevel: 2,
  totalBreakBefore: 1,
  pitchCountBefore: 1,
  cost: null,
};

beforeEach(() => {
  cancelPendingSave();
  savePlan.mockImplementation((plan: unknown) => Promise.resolve(plan));
  saveBreakingCacheRows.mockResolvedValue(undefined);
  useGameDataStore.setState({
    status: "ready",
    games: [],
    defaultGameId: "sample2024",
    gameId: "sample2024",
    gameData: createSampleGameData(),
    loadError: null,
    overrides: [],
    storageWarning: null,
  });
  setPlan({});
  useResultStore.setState({ result: null, calculating: false });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("BreakingBallTab", () => {
  it("UI-T4-02: 目標変化球構成の入力欄が表示される", () => {
    render(<BreakingBallTab />);

    expect(screen.getByTestId("breaking-composition")).toBeTruthy();
    expect(screen.getByTestId("breaking-composition-add")).toBeTruthy();
  });

  it("UI-T4-03: 球種を追加すると総変化量と球種数が集計される", () => {
    setBreaking({
      composition: [
        { pitchType: "slider", level: 4 },
        { pitchType: "curve", level: 3 },
      ],
      mode: "none",
      aggregate: null,
      steps: [],
    });
    render(<BreakingBallTab />);

    expect(screen.getByTestId("breaking-total-level").textContent).toBe("7");
    expect(screen.getByTestId("breaking-pitch-count").textContent).toBe("2");

    fireEvent.click(screen.getByTestId("breaking-composition-add"));

    expect(currentBreaking()?.composition).toHaveLength(3);
  });

  it("UI-T4-04: 未入力のときは未計測の案内と2つの入力ボタンが出る", () => {
    setBreaking({
      composition: [{ pitchType: "slider", level: 4 }],
      mode: "none",
      aggregate: null,
      steps: [],
    });
    render(<BreakingBallTab />);

    expect(screen.getByTestId("breaking-not-measured").textContent).toContain(NOT_MEASURED_TITLE);

    fireEvent.click(screen.getByTestId("breaking-start-aggregate"));

    expect(currentBreaking()?.mode).toBe("aggregate");
  });

  it("UI-T4-05: 未入力の構成は 0 として計上されず未完成になる", () => {
    setBreaking({
      composition: [{ pitchType: "slider", level: 4 }],
      mode: "none",
      aggregate: null,
      steps: [],
    });
    recalculate();

    const result = useResultStore.getState().result;
    expect(result?.breaking).toHaveLength(0);
    expect(result?.status).toBe("incomplete");
    expect(result?.issues.map((issue) => issue.code)).toContain("BREAKING_DATA_MISSING");
  });

  it("UI-T4-06: 一括で5項目を入力すると手動入力として計上される", () => {
    setBreaking({ composition: [], mode: "aggregate", aggregate: null, steps: [] });
    render(<BreakingBallTab />);

    for (const [key, value] of [
      ["muscle", "0"],
      ["agility", "0"],
      ["technique", "450"],
      ["breaking", "1280"],
      ["mental", "100"],
    ] as const) {
      fireEvent.change(screen.getByTestId(`breaking-aggregate-${key}`), {
        target: { value },
      });
    }
    recalculate();

    const result = useResultStore.getState().result;
    expect(result?.breaking[0]?.source).toBe("manual");
    expect(result?.total.breaking).toBe(1280);
    expect(result?.issues).toHaveLength(0);
  });

  it("UI-T4-07: 一括の1項目を空にすると未入力扱いになる", () => {
    setBreaking({
      composition: [],
      mode: "aggregate",
      aggregate: { muscle: 0, agility: 0, technique: 450, breaking: 1280, mental: 100 },
      steps: [],
    });
    render(<BreakingBallTab />);

    fireEvent.change(screen.getByTestId("breaking-aggregate-technique"), {
      target: { value: "" },
    });
    recalculate();

    expect(currentBreaking()?.aggregate).toBeNull();
    expect(useResultStore.getState().result?.issues.map((issue) => issue.code)).toContain(
      "BREAKING_DATA_MISSING",
    );
  });

  it("UI-T4-08: ステップ方式に切り替えるとステップ表が出る", () => {
    setBreaking({ composition: [], mode: "step", aggregate: null, steps: [] });
    render(<BreakingBallTab />);

    fireEvent.click(screen.getByTestId("breaking-step-add"));

    expect(currentBreaking()?.steps).toHaveLength(1);
    expect(screen.getByTestId("breaking-step-1")).toBeTruthy();
  });

  it("UI-T4-09: キャッシュに一致するキーでは経験点が自動入力され実測と表示される", () => {
    setBreaking({ composition: [], mode: "step", aggregate: null, steps: [CACHED_STEP] });
    render(<BreakingBallTab />);

    expect(
      (screen.getByTestId("breaking-step-cost-1-technique") as HTMLInputElement).value,
    ).toBe("10");
    expect((screen.getByTestId("breaking-step-cost-1-breaking") as HTMLInputElement).value).toBe(
      "50",
    );
    expect(screen.getByTestId("breaking-step-source-1").textContent).toBe("実測");
  });

  it("UI-T4-10: 自動入力値を書き換えると手動になる", () => {
    setBreaking({ composition: [], mode: "step", aggregate: null, steps: [CACHED_STEP] });
    render(<BreakingBallTab />);

    fireEvent.change(screen.getByTestId("breaking-step-cost-1-technique"), {
      target: { value: "99" },
    });

    expect(currentBreaking()?.steps[0]?.cost).toEqual({
      muscle: 0,
      agility: 0,
      technique: 99,
      breaking: 50,
      mental: 0,
    });
    expect(screen.getByTestId("breaking-step-source-1").textContent).toBe("手動入力");
  });

  it("UI-T4-11: キャッシュに無いキーは 0 にせず未登録と表示する", () => {
    setBreaking({
      composition: [],
      mode: "step",
      aggregate: null,
      steps: [{ ...CACHED_STEP, totalBreakBefore: 9 }],
    });
    recalculate();
    render(<BreakingBallTab />);

    expect((screen.getByTestId("breaking-step-cost-1-breaking") as HTMLInputElement).value).toBe(
      "",
    );
    expect(screen.getByTestId("breaking-step-issue-1").textContent).toContain(
      STEP_UNREGISTERED_TEXT,
    );
    expect(useResultStore.getState().result?.status).toBe("incomplete");
  });

  it("UI-T4-12: 後（toLevel）は前+1に自動設定され編集できない", () => {
    setBreaking({ composition: [], mode: "step", aggregate: null, steps: [CACHED_STEP] });
    render(<BreakingBallTab />);

    fireEvent.change(screen.getByTestId("breaking-step-from-1"), { target: { value: "4" } });

    expect(currentBreaking()?.steps[0]?.toLevel).toBe(5);
    expect((screen.getByTestId("breaking-step-to-1") as HTMLInputElement).readOnly).toBe(true);
  });

  it("UI-T4-13: 入力済みステップを共通キャッシュへ登録できる", () => {
    setBreaking({
      composition: [],
      mode: "step",
      aggregate: null,
      steps: [
        {
          ...CACHED_STEP,
          totalBreakBefore: 5,
          cost: { muscle: 0, agility: 0, technique: 30, breaking: 120, mental: 0 },
        },
      ],
    });
    render(<BreakingBallTab />);

    fireEvent.click(screen.getByTestId("breaking-cache-register"));

    expect(saveBreakingCacheRows).toHaveBeenCalledTimes(1);
    expect(saveBreakingCacheRows.mock.calls[0]?.[1]).toBe("sense_plus");
    expect(saveBreakingCacheRows.mock.calls[0]?.[2]).toEqual([
      {
        pitchType: "slider",
        fromLevel: 1,
        toLevel: 2,
        totalBreakBefore: 5,
        pitchCountBefore: 1,
        cost: { muscle: 0, agility: 0, technique: 30, breaking: 120, mental: 0 },
      },
    ]);
  });

  it("UI-T4-14: 既存キーと重複する登録は確認ダイアログを出す", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    setBreaking({
      composition: [],
      mode: "step",
      aggregate: null,
      steps: [
        {
          ...CACHED_STEP,
          cost: { muscle: 0, agility: 0, technique: 11, breaking: 51, mental: 0 },
        },
      ],
    });
    render(<BreakingBallTab />);

    fireEvent.click(screen.getByTestId("breaking-cache-register"));

    expect(confirmSpy).toHaveBeenCalledWith(CACHE_OVERWRITE_CONFIRM);
    expect(saveBreakingCacheRows).not.toHaveBeenCalled();
  });

  it("UI-T4-15: 一括とステップの両方に値があるときは一括値が使われる", () => {
    setBreaking({
      composition: [],
      mode: "aggregate",
      aggregate: { muscle: 0, agility: 0, technique: 450, breaking: 1280, mental: 100 },
      steps: [CACHED_STEP],
    });
    recalculate();

    const result = useResultStore.getState().result;
    expect(result?.breaking).toHaveLength(1);
    expect(result?.total.breaking).toBe(1280);
  });

  it("UI-T4-16: センス○を切り替えると参照するキャッシュが切り替わる", () => {
    setBreaking(
      { composition: [], mode: "step", aggregate: null, steps: [CACHED_STEP] },
      { senseMode: "normal" },
    );
    render(<BreakingBallTab />);

    // 通常キャッシュの slider 1→2 は技術20 / 変化球100（センス○は技術10 / 変化球50）
    expect(
      (screen.getByTestId("breaking-step-cost-1-technique") as HTMLInputElement).value,
    ).toBe("20");
    expect((screen.getByTestId("breaking-step-cost-1-breaking") as HTMLInputElement).value).toBe(
      "100",
    );
  });
});
