/**
 * UI-T3 系の自動化分（05_ui_spec.md §5）。
 * 期待値は 11_unit_test_spec.md §1 の標準フィクスチャから導出した確定値。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PlayerPlan } from "@/domain/models/plan";
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
const { SpecialAbilityTab } = await import("@/ui/tabs/SpecialAbilityTab");
const { FIELDER_ONLY_NOTE } = await import("@/ui/components/AbilityPicker");

function setPlan(patch: Partial<PlayerPlan>): void {
  usePlanStore.setState({
    plan: { ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"), ...patch },
    dirty: false,
  });
}

function recalculate(): void {
  act(() => {
    useResultStore.getState().recalculate();
  });
}

function search(text: string): void {
  fireEvent.change(screen.getByTestId("ability-search"), { target: { value: text } });
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

function optionsOf(testId: string): string[] {
  return [...(screen.getByTestId(testId) as HTMLSelectElement).options].map(
    (option) => option.value,
  );
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
  setPlan({});
  useResultStore.setState({ result: null, calculating: false });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.clearAllMocks();
});

describe("AbilityPicker（UI-T3-01〜04・23）", () => {
  it("UI-T3-01: 表示名で検索できる", () => {
    render(<SpecialAbilityTab />);
    search("奪三振");

    expect(screen.getByTestId("picker-add-strikeout")).toBeTruthy();
    expect(screen.queryByTestId("picker-add-power_hitter")).toBeNull();
  });

  it("UI-T3-02: ability_id でも検索できる", () => {
    render(<SpecialAbilityTab />);
    search("strikeout");

    expect(screen.getByTestId("picker-add-strikeout")).toBeTruthy();
  });

  it("UI-T3-03: 投手プランでは野手専用能力も (野手専用) 付きで表示される", () => {
    render(<SpecialAbilityTab />);
    search("power_hitter");

    expect(textOf("picker-name-power_hitter")).toContain(FIELDER_ONLY_NOTE);
  });

  it("UI-T3-03（対比）: 野手プランでは投手専用能力を表示しない", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    search("strikeout");

    expect(screen.queryByTestId("picker-add-strikeout")).toBeNull();
  });

  it("UI-T3-04: 種別フィルタ「金特」で金特のみになる", () => {
    render(<SpecialAbilityTab />);
    fireEvent.change(screen.getByTestId("ability-kind-filter"), { target: { value: "gold" } });

    expect(screen.getByTestId("picker-add-archartist")).toBeTruthy();
    expect(screen.queryByTestId("picker-add-strikeout")).toBeNull();
  });

  it("UI-T3-23: 投手プランでは pitcher / common が先、野手専用が後ろに並ぶ", () => {
    render(<SpecialAbilityTab />);

    const names = within(screen.getByTestId("picker-results"))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    const fielderFlags = names.map((name) => name.includes(FIELDER_ONLY_NOTE));
    const lastNonFielder = fielderFlags.lastIndexOf(false);
    const firstFielder = fielderFlags.indexOf(true);

    expect(firstFielder).toBeGreaterThan(lastNonFielder);
    expect(screen.getByTestId("picker-fielder-divider")).toBeTruthy();
  });
});

describe("選択中の青特（UI-T3-05〜11・24）", () => {
  it("UI-T3-05: 追加すると一覧に行が増え、ボタンが「追加済み」になる", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-strikeout"));

    expect(screen.getByTestId("blue-row-strikeout")).toBeTruthy();
    const button = screen.getByTestId("picker-add-strikeout") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("追加済み");
  });

  it("UI-T3-06: binary 青特のセレクトは NONE / ON のみ", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-strikeout"));

    expect(optionsOf("blue-current-strikeout")).toEqual(["NONE", "ON"]);
    expect(optionsOf("blue-target-strikeout")).toEqual(["NONE", "ON"]);
  });

  it("UI-T3-07 / UI-T3-08: rank 青特は G〜A を選べ、D→A は3遷移分を合計する", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-chance"));

    expect(optionsOf("blue-current-chance")).toEqual(["G", "F", "E", "D", "C", "B", "A"]);

    fireEvent.change(screen.getByTestId("blue-current-chance"), { target: { value: "D" } });
    recalculate();

    // (0,16,28,0,100)+(0,20,35,0,125)+(0,24,42,0,150) にセンス○倍率 0.9 を掛けて切り捨て
    expect(textOf("blue-exp-chance")).toContain("敏捷 54");
    expect(textOf("blue-exp-chance")).toContain("技術 94");
    expect(textOf("blue-exp-chance")).toContain("精神 337");
  });

  it("UI-T3-09: コツLvを上げると必要経験点が減る", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-strikeout"));
    recalculate();
    expect(textOf("blue-exp-strikeout")).toContain("筋力 31");

    fireEvent.change(screen.getByTestId("blue-hint-strikeout"), { target: { value: "3" } });
    recalculate();

    expect(textOf("blue-exp-strikeout")).toContain("筋力 12");
  });

  it("UI-T3-10: 現在 = 目標 なら必要経験点が 0 になる", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-strikeout"));
    fireEvent.change(screen.getByTestId("blue-current-strikeout"), { target: { value: "ON" } });
    recalculate();

    expect(textOf("blue-exp-strikeout")).toContain("筋力 0");
    expect(textOf("blue-exp-strikeout")).toContain("技術 0");
  });

  it("UI-T3-11: 目標が現在より下位なら INVALID_TARGET を赤字表示する", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-strikeout"));
    fireEvent.change(screen.getByTestId("blue-current-strikeout"), { target: { value: "ON" } });
    fireEvent.change(screen.getByTestId("blue-target-strikeout"), { target: { value: "NONE" } });
    recalculate();

    expect(screen.getByTestId("blue-exp-strikeout").className).toContain("cell-error");
    expect(textOf("blue-exp-strikeout")).toContain("INVALID_TARGET");
    expect(screen.getByTestId("blue-target-strikeout").className).toContain("input-error");
  });

  it("UI-T3-24: 投手プランで野手専用青特を追加しても実測どおりに計上される", () => {
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-power_hitter"));
    recalculate();

    const result = useResultStore.getState().result;
    expect(result?.issues.some((issue) => issue.code === "BLUE_DATA_MISSING")).toBe(false);
    // 240 × 1.0（コツLv0）× 0.9（センス○）= 216
    expect(textOf("blue-exp-power_hitter")).toContain("筋力 216");
    expect(textOf("blue-name-power_hitter")).toContain(FIELDER_ONLY_NOTE);
  });
});

describe("選択中の金特（UI-T3-12〜22）", () => {
  it("UI-T3-12 / UI-T3-13: 下位青特が🔗付きで自動追加され、削除ボタンを持たない", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));

    expect(screen.getByTestId("blue-row-power_hitter")).toBeTruthy();
    expect(textOf("blue-auto-note-power_hitter")).toContain("🔗");
    expect(textOf("blue-auto-note-power_hitter")).toContain("アーチストの前提として自動追加");
    expect(screen.queryByTestId("blue-remove-power_hitter")).toBeNull();
  });

  it("UI-T3-14: 金特を削除すると自動追加された青特も消える", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    fireEvent.click(screen.getByTestId("gold-remove-archartist"));

    expect(screen.queryByTestId("blue-row-power_hitter")).toBeNull();
    expect(screen.queryByTestId("gold-row-archartist")).toBeNull();
  });

  it("UI-T3-15 / UI-T3-16: 手動追加と自動追加が重なっても1行・1回だけ計上する", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-power_hitter"));
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    recalculate();

    expect(screen.getAllByTestId("blue-row-power_hitter")).toHaveLength(1);
    expect(textOf("blue-auto-note-power_hitter")).toContain("前提でもあります");
    expect(screen.getByTestId("blue-remove-power_hitter")).toBeTruthy();

    const result = useResultStore.getState().result;
    expect(result?.blue.filter((item) => item.id === "power_hitter")).toHaveLength(1);
  });

  it("UI-T3-17: 下位青特の現在を ON にすると青特分が 0 になり金特分だけ残る", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    fireEvent.change(screen.getByTestId("blue-current-power_hitter"), { target: { value: "ON" } });
    recalculate();

    const result = useResultStore.getState().result;
    expect(result?.subtotal.blue).toEqual({
      muscle: 0,
      agility: 0,
      technique: 0,
      breaking: 0,
      mental: 0,
    });
    expect(result?.subtotal.gold.muscle).toBeGreaterThan(0);
  });

  it("UI-T3-18: 金特のコツLvと下位青特のコツLvが独立して反映される", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    fireEvent.change(screen.getByTestId("gold-hint-archartist"), { target: { value: "3" } });
    fireEvent.change(screen.getByTestId("gold-lower-hint-archartist"), { target: { value: "2" } });
    recalculate();

    // 金特は Lv3 の実測値をそのまま使う
    expect(textOf("gold-exp-archartist")).toContain("筋力 60");
    // 下位青特は 240 × 0.5（コツLv2）× 0.9（センス○）= 108
    expect(textOf("blue-exp-power_hitter")).toContain("筋力 108");
  });

  it("UI-T3-19: 実測Lvがある金特には [実測] バッジが付く", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    fireEvent.change(screen.getByTestId("gold-hint-archartist"), { target: { value: "1" } });
    recalculate();

    expect(textOf("gold-source-archartist")).toBe("実測");
  });

  it("UI-T3-20: 実測Lvがない金特は推定バッジになる", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    recalculate();

    expect(["推定", "高信頼推定"]).toContain(textOf("gold-source-archartist"));
  });

  it("UI-T3-21: 実測が1件もない金特は赤字表示になり未完成になる", () => {
    setPlan({ playerType: "fielder", senseMode: "normal" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-archartist"));
    recalculate();

    expect(screen.getByTestId("gold-exp-archartist").className).toContain("cell-error");
    expect(textOf("gold-exp-archartist")).toContain("実測データが1件もありません");
    expect(useResultStore.getState().result?.status).toBe("incomplete");
  });

  it("UI-T3-22: rank 前提の金特は目標ランク A で自動追加される", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-clutch_master"));

    expect((screen.getByTestId("blue-target-chance") as HTMLSelectElement).value).toBe("A");
    expect(textOf("gold-prereq-clutch_master")).toContain("チャンス");
  });

  it("前提を持たない金特では下位青特のコツLvを表示しない", () => {
    setPlan({ playerType: "fielder" });
    render(<SpecialAbilityTab />);
    fireEvent.click(screen.getByTestId("picker-add-laser_beam"));

    expect(screen.queryByTestId("gold-lower-hint-laser_beam")).toBeNull();
    expect(textOf("gold-prereq-laser_beam")).toBe("前提: なし");
  });

  it("ゲームデータ未ロード時は準備中を表示する", () => {
    useGameDataStore.setState({ status: "loading", gameData: null });
    render(<SpecialAbilityTab />);

    expect(screen.getByTestId("special-loading")).toBeTruthy();
  });
});
