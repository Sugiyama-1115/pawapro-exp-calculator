/**
 * UI-CM 系（05_ui_spec.md §1）。アプリ骨格の常時表示・タブ切替・ゲーム切替を検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GameDefinition } from "@/data/repositories/gameDataLoader";
import { createSampleGameData } from "../../fixtures/sampleGameData";

const loadGameData = vi.fn();
const loadGamesManifest = vi.fn();
const getAppState = vi.fn();

vi.mock("@/data/repositories/gameDataLoader", () => ({
  loadGamesManifest: (...args: unknown[]) => loadGamesManifest(...args) as unknown,
  loadGameData: (...args: unknown[]) => loadGameData(...args) as unknown,
}));

vi.mock("@/data/persistence/db", () => ({
  getAppState: (...args: unknown[]) => getAppState(...args) as unknown,
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
    savePlan: (plan: unknown) => Promise.resolve(plan),
  };
});

vi.mock("@/data/persistence/overrideRepository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/persistence/overrideRepository")>();
  return { ...actual, listOverrides: () => Promise.resolve([]) };
});

const { App, GAME_CHANGE_CONFIRM, resetAppBootstrap } = await import("@/App");
const { useGameDataStore } = await import("@/store/useGameDataStore");
const { cancelPendingSave, usePlanStore } = await import("@/store/usePlanStore");
const { useResultStore } = await import("@/store/useResultStore");

const GAMES: GameDefinition[] = [
  {
    id: "sample2024",
    displayName: "サンプルデータ（ダミー値）",
    directory: "sample2024",
    bundled: true,
    note: "動作確認用。",
  },
  {
    id: "pawapro2024",
    displayName: "パワプロ2024-2025",
    directory: "pawapro2024",
    bundled: false,
    note: "実測データ。",
  },
];

beforeEach(() => {
  resetAppBootstrap();
  cancelPendingSave();
  loadGamesManifest.mockResolvedValue({ games: GAMES, defaultGameId: "sample2024" });
  loadGameData.mockResolvedValue(createSampleGameData());
  getAppState.mockResolvedValue(null);
  useGameDataStore.setState({
    status: "idle",
    games: [],
    defaultGameId: "",
    gameId: null,
    gameData: null,
    loadError: null,
    overrides: [],
    storageWarning: null,
  });
  usePlanStore.setState({ plan: null, dirty: false, storageWarning: null });
  useResultStore.setState({ result: null, calculating: false });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function renderApp(): Promise<void> {
  render(<App />);
  await waitFor(() => {
    expect(useGameDataStore.getState().status).toBe("ready");
    expect(usePlanStore.getState().plan).not.toBeNull();
  });
}

describe("App", () => {
  it("UI-CM-01: ヘッダー・タブバー・結果サマリーバーが表示される", async () => {
    await renderApp();

    expect(screen.getByTestId("game-select")).toBeTruthy();
    expect(screen.getByTestId("tab-plan")).toBeTruthy();
    expect(screen.getByTestId("summary-bar")).toBeTruthy();
    expect(screen.getByTestId("summary-total")).toBeTruthy();
  });

  it("UI-CM-02: どのタブへ切り替えてもサマリーバーが表示され続ける", async () => {
    await renderApp();

    for (const tab of ["tab-base", "tab-special", "tab-breaking", "tab-result", "tab-plan"]) {
      fireEvent.click(screen.getByTestId(tab));
      expect(screen.getByTestId("summary-bar")).toBeTruthy();
    }
  });

  it("UI-CM-03: サンプルデータ選択時はヘッダーに注意バッジを出す", async () => {
    await renderApp();

    expect(screen.getByTestId("sample-data-badge").textContent).toBe(
      "サンプルデータ（実際の値ではありません）",
    );
  });

  it("UI-T1-02: games.json のゲームが全件表示される", async () => {
    await renderApp();

    const select = screen.getByTestId("game-select") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "sample2024",
      "pawapro2024",
    ]);
    expect(select.value).toBe("sample2024");
  });

  it("UI-T1-08: ゲーム変更は確認のうえ再ロードする", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderApp();
    loadGameData.mockClear();

    fireEvent.change(screen.getByTestId("game-select"), { target: { value: "pawapro2024" } });

    expect(confirmSpy).toHaveBeenCalledWith(GAME_CHANGE_CONFIRM);
    await waitFor(() => {
      expect(useGameDataStore.getState().gameId).toBe("pawapro2024");
    });
    // ゲーム変更では入力内容をクリアしない（05_ui_spec.md §3.2）
    expect(usePlanStore.getState().plan?.gameId).toBe("pawapro2024");
  });

  it("UI-T1-08: 確認をキャンセルするとゲームは変わらない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderApp();

    fireEvent.change(screen.getByTestId("game-select"), { target: { value: "pawapro2024" } });

    expect(useGameDataStore.getState().gameId).toBe("sample2024");
  });

  it("UI-T4-01: 野手プランでは変化球タブを表示しない", async () => {
    await renderApp();
    expect(screen.getByTestId("tab-breaking")).toBeTruthy();

    const plan = usePlanStore.getState().plan;
    if (plan) usePlanStore.setState({ plan: { ...plan, playerType: "fielder" } });

    await waitFor(() => {
      expect(screen.queryByTestId("tab-breaking")).toBeNull();
    });
  });

  it("ロードが完了するまでタブ1以外は操作できない", () => {
    render(<App />);

    expect((screen.getByTestId("tab-base") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("tab-plan") as HTMLButtonElement).disabled).toBe(false);
  });

  it("UI-T5-13: サマリーバーの不足件数から計算結果タブへ遷移する", async () => {
    await renderApp();
    useResultStore.setState({
      result: {
        total: { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 },
        subtotal: {
          base: { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 },
          blue: { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 },
          gold: { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 },
          breaking: { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 },
        },
        base: [],
        blue: [],
        gold: [],
        breaking: [],
        status: "incomplete",
        issues: [
          { code: "BASE_DATA_MISSING", category: "base", targetId: "stamina", message: "不足1" },
        ],
      },
      calculating: false,
    });

    fireEvent.click(await screen.findByTestId("summary-issue-count"));

    expect(screen.getByTestId("result-tab")).toBeTruthy();
  });

  it("永続化の警告はバーとして表示される", async () => {
    await renderApp();
    useGameDataStore.setState({ storageWarning: "保存データの読み込みに失敗しました。" });

    expect((await screen.findByTestId("storage-warning")).textContent).toBe(
      "保存データの読み込みに失敗しました。",
    );
  });
});
