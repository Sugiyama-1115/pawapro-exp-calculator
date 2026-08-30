/**
 * UT-ST-GAME: ゲームデータストア（02_architecture.md §6 / 06_persistence_spec.md §5.1）。
 * fetch と IndexedDB はモックし、検証ロジックは実物を通す。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { GameDataSet } from "@/domain/models/gameData";
import type { GameDefinition } from "@/data/repositories/gameDataLoader";
import { createSampleGameData } from "../../fixtures/sampleGameData";
import { readFixture, readValidCsv } from "../../fixtures/csvFixtures";

const loadGamesManifest = vi.fn();
const loadGameData = vi.fn();
const listOverrides = vi.fn();
const saveOverride = vi.fn();
const clearOverride = vi.fn();
const loadBreakingCacheEntries = vi.fn();
const getAppState = vi.fn();
const setAppState = vi.fn();

vi.mock("@/data/repositories/gameDataLoader", () => ({
  loadGamesManifest: (...args: unknown[]) => loadGamesManifest(...args) as unknown,
  loadGameData: (...args: unknown[]) => loadGameData(...args) as unknown,
}));

vi.mock("@/data/persistence/breakingCacheRepository", () => ({
  loadBreakingCacheEntries: (...args: unknown[]) => loadBreakingCacheEntries(...args) as unknown,
}));

vi.mock("@/data/persistence/db", () => ({
  getAppState: (...args: unknown[]) => getAppState(...args) as unknown,
  setAppState: (...args: unknown[]) => setAppState(...args) as unknown,
}));

vi.mock("@/data/persistence/overrideRepository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/persistence/overrideRepository")>();
  return {
    ...actual,
    listOverrides: (...args: unknown[]) => listOverrides(...args) as unknown,
    saveOverride: (...args: unknown[]) => saveOverride(...args) as unknown,
    clearOverride: (...args: unknown[]) => clearOverride(...args) as unknown,
  };
});

const { describeRowCounts, isSampleGame, selectCurrentGame, useGameDataStore } = await import(
  "@/store/useGameDataStore"
);

const SAMPLE_GAME: GameDefinition = {
  id: "sample2024",
  displayName: "サンプルデータ（ダミー値）",
  directory: "sample2024",
  bundled: true,
  note: "動作確認用。",
};

const REAL_GAME: GameDefinition = {
  id: "pawapro2024",
  displayName: "パワプロ2024-2025",
  directory: "pawapro2024",
  bundled: false,
  note: "実測データ。",
};

let sampleData: GameDataSet;

beforeEach(() => {
  sampleData = createSampleGameData();
  loadGamesManifest.mockResolvedValue({
    games: [SAMPLE_GAME, REAL_GAME],
    defaultGameId: SAMPLE_GAME.id,
  });
  loadGameData.mockResolvedValue(sampleData);
  listOverrides.mockResolvedValue([]);
  saveOverride.mockImplementation(
    (gameId: string, kind: string, rows: unknown[], fileName: string) =>
      Promise.resolve({
        gameId,
        kind,
        rows,
        rowCount: rows.length,
        importedAt: "2026-08-31T00:00:00.000Z",
        fileName,
      }),
  );
  clearOverride.mockResolvedValue(undefined);
  loadBreakingCacheEntries.mockResolvedValue([]);
  getAppState.mockResolvedValue(null);
  setAppState.mockResolvedValue(undefined);
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useGameDataStore", () => {
  it("UT-ST-GAME-01: initialize で games.json を読み、既定ゲームをロードする", async () => {
    await useGameDataStore.getState().initialize();

    const state = useGameDataStore.getState();
    expect(state.status).toBe("ready");
    expect(state.games).toHaveLength(2);
    expect(state.gameId).toBe("sample2024");
    expect(state.gameData).toBe(sampleData);
    expect(setAppState).toHaveBeenCalledWith("lastGameId", "sample2024");
  });

  it("UT-ST-GAME-02: 前回選択したゲームを復元する", async () => {
    getAppState.mockResolvedValue("pawapro2024");

    await useGameDataStore.getState().initialize();

    expect(useGameDataStore.getState().gameId).toBe("pawapro2024");
  });

  it("UT-ST-GAME-03: ロード失敗時は status=error とし検証エラーを全件保持する", async () => {
    const issues = [
      { code: ERROR_CODES.INVALID_CSV, file: "blue_abilities.csv", line: 3, column: "muscle", message: "エラー1" },
      { code: ERROR_CODES.INVALID_CSV, file: "blue_abilities.csv", line: 5, column: "muscle", message: "エラー2" },
    ];
    loadGameData.mockRejectedValue(
      new AppError(ERROR_CODES.INVALID_CSV, "エラー1", { issues, omittedCount: 7 }),
    );

    await useGameDataStore.getState().initialize();

    const state = useGameDataStore.getState();
    expect(state.status).toBe("error");
    expect(state.gameData).toBeNull();
    expect(state.loadError?.issues).toHaveLength(2);
    expect(state.loadError?.omittedCount).toBe(7);
  });

  it("UT-ST-GAME-04: ゲーム切替で前バージョンのデータが残らない", async () => {
    await useGameDataStore.getState().initialize();
    const nextData = createSampleGameData();
    loadGameData.mockResolvedValue(nextData);

    await useGameDataStore.getState().loadGame("pawapro2024");

    const state = useGameDataStore.getState();
    expect(state.gameId).toBe("pawapro2024");
    expect(state.gameData).toBe(nextData);
    expect(state.gameData).not.toBe(sampleData);
  });

  it("UT-ST-GAME-05: 検証エラーのCSVはインポートされず、既存データが維持される", async () => {
    await useGameDataStore.getState().initialize();
    loadGameData.mockClear();

    const outcome = await useGameDataStore
      .getState()
      .importCsv("base_sense_plus", "base_negative.csv", readFixture("invalid", "base_negative.csv"));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.issues.length).toBeGreaterThan(0);
      expect(outcome.message).toContain("インポートは適用されませんでした");
    }
    // 参照整合の再構築まで進まないこと（＝一切適用されないこと）
    expect(loadGameData).not.toHaveBeenCalled();
    expect(saveOverride).not.toHaveBeenCalled();
    expect(useGameDataStore.getState().gameData).toBe(sampleData);
  });

  it("UT-ST-GAME-06: 正常なCSVはインポートされ overrides に反映される", async () => {
    await useGameDataStore.getState().initialize();
    const rebuilt = createSampleGameData();
    loadGameData.mockResolvedValue(rebuilt);

    const outcome = await useGameDataStore
      .getState()
      .importCsv("blue_abilities", "blue_abilities.csv", readValidCsv("blue_abilities"));

    expect(outcome.ok).toBe(true);
    expect(saveOverride).toHaveBeenCalledTimes(1);
    const state = useGameDataStore.getState();
    expect(state.gameData).toBe(rebuilt);
    expect(state.overrides.map((record) => record.kind)).toEqual(["blue_abilities"]);
  });

  it("UT-ST-GAME-07: 参照整合エラーで再構築に失敗した場合も適用しない", async () => {
    await useGameDataStore.getState().initialize();
    loadGameData.mockRejectedValue(
      new AppError(ERROR_CODES.INVALID_CSV, "参照エラー", {
        issues: [
          {
            code: ERROR_CODES.INVALID_CSV,
            file: "gold_prerequisites.csv",
            line: 2,
            column: "lower_blue_id",
            message: "参照エラー",
          },
        ],
      }),
    );

    const outcome = await useGameDataStore
      .getState()
      .importCsv("blue_abilities", "blue_abilities.csv", readValidCsv("blue_abilities"));

    expect(outcome.ok).toBe(false);
    expect(saveOverride).not.toHaveBeenCalled();
    expect(useGameDataStore.getState().gameData).toBe(sampleData);
  });

  it("UT-ST-GAME-08: 破棄すると標準データで再ロードされる", async () => {
    await useGameDataStore.getState().initialize();

    await useGameDataStore.getState().clearOverride("blue_abilities");

    expect(clearOverride).toHaveBeenCalledWith("sample2024", "blue_abilities");
    expect(useGameDataStore.getState().status).toBe("ready");
  });

  it("UT-ST-GAME-09: 永続化の失敗を握りつぶさず警告として保持する", async () => {
    listOverrides.mockRejectedValue(new AppError(ERROR_CODES.STORAGE_ERROR, "保存データの読み込みに失敗しました。"));

    await useGameDataStore.getState().initialize();

    const state = useGameDataStore.getState();
    expect(state.storageWarning).toBe("保存データの読み込みに失敗しました。");
    // 保存の失敗でロードは止めない
    expect(state.status).toBe("ready");
  });

  it("UT-ST-GAME-10: 行数内訳とサンプル判定が導出できる", () => {
    const counts = describeRowCounts(sampleData);
    expect(counts.find((entry) => entry.kind === "blue_abilities")?.count).toBe(sampleData.blue.size);
    expect(counts.some((entry) => entry.kind === "config")).toBe(false);

    expect(isSampleGame(SAMPLE_GAME)).toBe(true);
    expect(isSampleGame(REAL_GAME)).toBe(false);
    expect(isSampleGame(null)).toBe(false);
    expect(selectCurrentGame({ games: [SAMPLE_GAME], gameId: "sample2024" })).toBe(SAMPLE_GAME);
    expect(selectCurrentGame({ games: [SAMPLE_GAME], gameId: "unknown" })).toBeNull();
  });
});
