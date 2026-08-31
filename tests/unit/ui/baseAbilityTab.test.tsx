/**
 * UI-T2 系の自動化分（05_ui_spec.md §4）。
 * 期待値は 11_unit_test_spec.md §1 の標準フィクスチャから導出した確定値。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createSampleGameData } from "../../fixtures/sampleGameData";

const savePlan = vi.fn();

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
const { BaseAbilityTab, NO_COST_TEXT, TARGET_BELOW_CURRENT_MESSAGE } = await import(
  "@/ui/tabs/BaseAbilityTab"
);

/** 再計算は App のデバウンス購読が担うため、テストでは同期的に実行する。 */
function recalculate(): void {
  act(() => {
    useResultStore.getState().recalculate();
  });
}

function setValue(testId: string, value: string): void {
  const input = screen.getByTestId(testId);
  fireEvent.change(input, { target: { value } });
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

beforeEach(() => {
  savePlan.mockImplementation((plan: unknown) => Promise.resolve(plan));
  cancelPendingSave();
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
  usePlanStore.setState({
    plan: createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
    dirty: false,
    storageWarning: null,
  });
  useResultStore.setState({ result: null, calculating: false });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.clearAllMocks();
});

describe("BaseAbilityTab", () => {
  it("UI-T2-01 / UI-T2-02: 投手能力のみが display_order 昇順で並ぶ", () => {
    render(<BaseAbilityTab />);

    const rows = within(screen.getByTestId("base-table")).getAllByRole("row");
    const ids = rows
      .map((row) => row.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && id.startsWith("base-row-"));

    expect(ids).toEqual(["base-row-velocity", "base-row-control", "base-row-stamina"]);
  });

  it("UI-T2-03: 初期値・目標値の入力で必要経験点が表示される", () => {
    render(<BaseAbilityTab />);

    setValue("base-current-velocity", "130");
    setValue("base-target-velocity", "132");
    recalculate();

    expect(textOf("base-exp-velocity")).toContain("筋力 20");
    expect(textOf("base-exp-velocity")).toContain("技術 10");
  });

  it("UI-T2-04: 目標値が初期値未満なら赤枠とメッセージを出す", () => {
    render(<BaseAbilityTab />);

    setValue("base-current-velocity", "140");
    setValue("base-target-velocity", "130");

    expect(screen.getByTestId("base-target-velocity").className).toContain("input-error");
    expect(textOf("base-target-error-velocity")).toBe(TARGET_BELOW_CURRENT_MESSAGE);
  });

  it("UI-T2-05: 目標値 = 初期値 なら「—」を表示しエラーにしない", () => {
    render(<BaseAbilityTab />);

    setValue("base-current-velocity", "130");
    setValue("base-target-velocity", "130");
    recalculate();

    expect(textOf("base-exp-velocity")).toBe(NO_COST_TEXT);
    expect(useResultStore.getState().result?.status).toBe("confirmed");
  });

  it("UI-T2-06 / UI-T2-07: 欠落段階は ⚠ 表示になり 0 補完せず未完成になる", () => {
    render(<BaseAbilityTab />);

    setValue("base-current-velocity", "130");
    setValue("base-target-velocity", "135");
    recalculate();

    expect(textOf("base-exp-velocity")).toContain("⚠");
    expect(textOf("base-exp-velocity")).toContain("経験点データがありません");
    // 130→134 の4段階分（10+10+12+12）のみが積み上がり、欠落分は 0 として足されない
    expect(textOf("base-subtotal-muscle")).toBe("44");
    expect(useResultStore.getState().result?.status).toBe("incomplete");
  });

  it("UI-T2-08: max_value を超える入力は確定時に上限へクランプされる", () => {
    render(<BaseAbilityTab />);

    const target = screen.getByTestId("base-target-velocity");
    fireEvent.change(target, { target: { value: "200" } });
    fireEvent.blur(target);

    expect(usePlanStore.getState().plan?.targetBase.velocity).toBe(170);
  });

  it("UI-T2-09: 空欄のまま確定すると直前の有効値に戻る", () => {
    render(<BaseAbilityTab />);

    const target = screen.getByTestId("base-target-velocity") as HTMLInputElement;
    fireEvent.change(target, { target: { value: "140" } });
    fireEvent.blur(target);
    fireEvent.change(target, { target: { value: "" } });
    fireEvent.blur(target);

    expect(target.value).toBe("140");
    expect(usePlanStore.getState().plan?.targetBase.velocity).toBe(140);
  });

  it("UI-T2-10: 弾道は 1〜4 のセレクトになる", () => {
    usePlanStore.setState({
      plan: {
        ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
        playerType: "fielder",
      },
    });
    render(<BaseAbilityTab />);

    const select = screen.getByTestId("base-current-trajectory") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect([...select.options].map((option) => option.value)).toEqual(["", "1", "2", "3", "4"]);
  });

  it("UI-T2-11: 投手プランでも野手能力を折りたたみ領域で入力できる", () => {
    render(<BaseAbilityTab />);

    expect(screen.getByTestId("base-fielder-section")).toBeTruthy();
    setValue("base-current-contact", "40");
    setValue("base-target-contact", "42");
    recalculate();

    expect(textOf("base-exp-contact")).toContain("技術 10");
    expect(useResultStore.getState().result?.status).toBe("confirmed");
  });

  it("UI-T2-12: 小計行が各能力の合計と一致する", () => {
    render(<BaseAbilityTab />);

    setValue("base-current-velocity", "130");
    setValue("base-target-velocity", "132");
    setValue("base-current-control", "40");
    setValue("base-target-control", "42");
    recalculate();

    expect(textOf("base-subtotal-muscle")).toBe("20");
    expect(textOf("base-subtotal-technique")).toBe("18");
    expect(textOf("base-subtotal-mental")).toBe("6");
  });

  it("ゲームデータ未ロード時は準備中を表示する", () => {
    useGameDataStore.setState({ status: "loading", gameData: null });
    render(<BaseAbilityTab />);

    expect(screen.getByTestId("base-loading")).toBeTruthy();
  });
});
