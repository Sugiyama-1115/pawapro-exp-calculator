/**
 * UI-T1 / UI-IM 系の自動化分（05_ui_spec.md §3）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { GameDefinition } from "@/data/repositories/gameDataLoader";
import { createSampleGameData } from "../../fixtures/sampleGameData";
import { readFixture, readValidCsv } from "../../fixtures/csvFixtures";

const loadGameData = vi.fn();
const savePlan = vi.fn();
const setAppState = vi.fn();

vi.mock("@/data/repositories/gameDataLoader", () => ({
  loadGamesManifest: () => Promise.resolve({ games: [], defaultGameId: "" }),
  loadGameData: (...args: unknown[]) => loadGameData(...args) as unknown,
}));

vi.mock("@/data/persistence/db", () => ({
  getAppState: () => Promise.resolve(null),
  setAppState: (...args: unknown[]) => setAppState(...args) as unknown,
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
  const actual =
    await importOriginal<typeof import("@/data/persistence/overrideRepository")>();
  return {
    ...actual,
    listOverrides: () => Promise.resolve([]),
    saveOverride: (gameId: string, kind: string, rows: unknown[], fileName: string) =>
      Promise.resolve({
        gameId,
        kind,
        rows,
        rowCount: rows.length,
        importedAt: "2026-08-31T00:00:00.000Z",
        fileName,
      }),
    clearOverride: () => Promise.resolve(undefined),
  };
});

const { useGameDataStore } = await import("@/store/useGameDataStore");
const { cancelPendingSave, createEmptyPlan, usePlanStore } = await import("@/store/usePlanStore");
const { PlanSettingTab, PLAN_NAME_ERROR, PLAYER_TYPE_CONFIRM } = await import(
  "@/ui/tabs/PlanSettingTab"
);

const SAMPLE_GAME: GameDefinition = {
  id: "sample2024",
  displayName: "サンプルデータ（ダミー値）",
  directory: "sample2024",
  bundled: true,
  note: "動作確認用。",
};

/** File.text() は jsdom 未実装のため、テキストを返す最小のスタブを使う。 */
function csvFile(name: string, text: string, size = text.length): File {
  return {
    name,
    size,
    text: () => Promise.resolve(text),
  } as unknown as File;
}

beforeEach(() => {
  savePlan.mockImplementation((plan: unknown) => Promise.resolve(plan));
  setAppState.mockResolvedValue(undefined);
  loadGameData.mockResolvedValue(createSampleGameData());
  cancelPendingSave();
  useGameDataStore.setState({
    status: "ready",
    games: [SAMPLE_GAME],
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
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("PlanSettingTab", () => {
  it("UI-T1-01: 既定は 投手 / センス○あり / 選手名『新規プラン』", () => {
    render(<PlanSettingTab />);

    expect((screen.getByTestId("plan-name") as HTMLInputElement).value).toBe("新規プラン");
    expect((screen.getByTestId("player-type-pitcher") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("sense-plus") as HTMLInputElement).checked).toBe(true);
  });

  it("UI-T1-03: 読み込んだ行数の内訳が確認できる", () => {
    render(<PlanSettingTab />);

    expect(screen.getByTestId("load-row-counts")).toBeTruthy();
    expect(screen.getByTestId("row-count-blue_abilities").textContent).toContain("blue_abilities.csv");
  });

  it("UI-T1-04: 選手名を空にしてフォーカスを外すとエラーを表示する", () => {
    render(<PlanSettingTab />);
    const input = screen.getByTestId("plan-name");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(screen.getByText(PLAN_NAME_ERROR)).toBeTruthy();
    expect(input.className).toContain("input-error");
  });

  it("UI-T1-05: 選手名は50文字を超えて入力できない", () => {
    render(<PlanSettingTab />);
    expect((screen.getByTestId("plan-name") as HTMLInputElement).maxLength).toBe(50);
  });

  it("UI-T1-06: 選手種別の変更は確認のうえ入力をクリアする", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    usePlanStore.setState({
      plan: {
        ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
        targetBase: { velocity: 140 },
      },
    });
    render(<PlanSettingTab />);

    fireEvent.click(screen.getByTestId("player-type-fielder"));

    expect(confirmSpy).toHaveBeenCalledWith(PLAYER_TYPE_CONFIRM);
    expect(usePlanStore.getState().plan?.playerType).toBe("fielder");
    expect(usePlanStore.getState().plan?.targetBase).toEqual({});
  });

  it("UI-T1-07: 確認をキャンセルすると種別も入力も変わらない", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    usePlanStore.setState({
      plan: {
        ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
        targetBase: { velocity: 140 },
      },
    });
    render(<PlanSettingTab />);

    fireEvent.click(screen.getByTestId("player-type-fielder"));

    expect(usePlanStore.getState().plan?.playerType).toBe("pitcher");
    expect(usePlanStore.getState().plan?.targetBase).toEqual({ velocity: 140 });
  });

  it("UI-T1-10: センス○を「なし」に変更できる", () => {
    render(<PlanSettingTab />);

    fireEvent.click(screen.getByTestId("sense-normal"));

    expect(usePlanStore.getState().plan?.senseMode).toBe("normal");
  });

  it("games.json の補足説明を表示する", () => {
    render(<PlanSettingTab />);
    expect(screen.getByTestId("game-note").textContent).toBe("動作確認用。");
  });

  it("UI-EX-02: ロードエラー時はエラーパネルに全件を表示する", () => {
    useGameDataStore.setState({
      status: "error",
      gameData: null,
      loadError: {
        code: ERROR_CODES.INVALID_CSV,
        message: "エラーがあります",
        issues: [
          { code: ERROR_CODES.INVALID_CSV, file: "blue_abilities.csv", line: 3, column: "muscle", message: "理由1" },
          { code: ERROR_CODES.INVALID_CSV, file: "blue_abilities.csv", line: 4, column: "muscle", message: "理由2" },
        ],
        omittedCount: 5,
      },
    });
    render(<PlanSettingTab />);

    const panel = screen.getByTestId("load-error-panel");
    expect(panel.textContent).toContain("理由1");
    expect(panel.textContent).toContain("理由2");
    expect(panel.textContent).toContain("他 5 件");
  });

  it("UI-T1-09: 未配置ゲームでは配置を促す案内が出る", () => {
    useGameDataStore.setState({
      status: "error",
      gameData: null,
      loadError: {
        code: ERROR_CODES.GAME_DATA_NOT_DEPLOYED,
        message: "このゲームのデータが配置されていません。CSVをインポートしてください。",
        issues: [],
        omittedCount: 0,
      },
    });
    render(<PlanSettingTab />);

    expect(screen.getByTestId("load-error-panel").textContent).toContain(
      "CSVをインポートしてください",
    );
  });
});

describe("CsvImportPanel", () => {
  it("UI-IM-01: 正常なCSVはインポート済として表示される", async () => {
    render(<PlanSettingTab />);
    const input = screen.getByTestId("csv-import-blue_abilities") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [csvFile("blue_abilities.csv", readValidCsv("blue_abilities"))] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("csv-discard-blue_abilities")).toBeTruthy();
    });
    expect(useGameDataStore.getState().overrides).toHaveLength(1);
  });

  it("UI-IM-02 / UI-IM-03: 検証エラーのCSVは適用されずエラー一覧が出る", async () => {
    const before = useGameDataStore.getState().gameData;
    render(<PlanSettingTab />);

    fireEvent.change(screen.getByTestId("csv-import-base_sense_plus"), {
      target: { files: [csvFile("base_negative.csv", readFixture("invalid", "base_negative.csv"))] },
    });

    const panel = await screen.findByTestId("csv-import-error-panel");
    expect(panel.textContent).toContain("インポートは適用されませんでした");
    expect(useGameDataStore.getState().gameData).toBe(before);
    expect(useGameDataStore.getState().overrides).toHaveLength(0);
  });

  it("UI-IM-06: 20MB超のファイルは拒否される", async () => {
    render(<PlanSettingTab />);

    fireEvent.change(screen.getByTestId("csv-import-blue_abilities"), {
      target: { files: [csvFile("big.csv", "a,b\n1,2\n", 20 * 1024 * 1024 + 1)] },
    });

    const panel = await screen.findByTestId("csv-import-error-panel");
    expect(panel.textContent).toContain("CSVファイル（20MB以下）を選択してください。");
  });

  it("UI-IM-06: 拡張子が csv でないファイルは拒否される", async () => {
    render(<PlanSettingTab />);

    fireEvent.change(screen.getByTestId("csv-import-blue_abilities"), {
      target: { files: [csvFile("plan.json", "{}")] },
    });

    const panel = await screen.findByTestId("csv-import-error-panel");
    expect(panel.textContent).toContain("CSVファイル（20MB以下）を選択してください。");
  });

  it("UI-IM-04: 破棄すると標準データへ戻る", async () => {
    useGameDataStore.setState({
      overrides: [
        {
          gameId: "sample2024",
          kind: "blue_abilities",
          rows: [],
          rowCount: 12,
          importedAt: "2026-08-31T00:00:00.000Z",
          fileName: "blue_abilities.csv",
        },
      ],
    });
    render(<PlanSettingTab />);
    expect(screen.getByText("インポート済 12行")).toBeTruthy();

    fireEvent.click(screen.getByTestId("csv-discard-blue_abilities"));

    await waitFor(() => {
      expect(useGameDataStore.getState().overrides).toHaveLength(0);
    });
  });

  it("UI-IM-08: 参照整合エラーになるCSVは適用されない", async () => {
    const before = useGameDataStore.getState().gameData;
    loadGameData.mockRejectedValue(
      new AppError(ERROR_CODES.INVALID_CSV, "参照エラー", {
        issues: [
          {
            code: ERROR_CODES.INVALID_CSV,
            file: "gold_prerequisites.csv",
            line: 2,
            column: "lower_blue_id",
            message: "lower_blue_id「unknown」が blue_abilities.csv に存在しません。",
          },
        ],
      }),
    );
    render(<PlanSettingTab />);

    fireEvent.change(screen.getByTestId("csv-import-gold_prerequisites"), {
      target: {
        files: [csvFile("gold_prerequisites.csv", readValidCsv("gold_prerequisites"))],
      },
    });

    const panel = await screen.findByTestId("csv-import-error-panel");
    expect(panel.textContent).toContain("blue_abilities.csv に存在しません");
    expect(useGameDataStore.getState().gameData).toBe(before);
  });
});
