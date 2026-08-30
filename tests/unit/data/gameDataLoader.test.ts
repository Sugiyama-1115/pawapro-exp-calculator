import { describe, expect, it } from "vitest";
import { parseCsv } from "@/data/csv/csvParser";
import type { CsvKind } from "@/data/csv/schemas";
import { CSV_FILE_NAMES, CSV_KINDS } from "@/data/csv/schemas";
import { validateFile } from "@/data/csv/validators";
import type { CsvFetcher, GameDefinition } from "@/data/repositories/gameDataLoader";
import { dataUrl, loadGameData, loadGamesManifest } from "@/data/repositories/gameDataLoader";
import { baseKey, blueKey, breakingKey } from "@/data/repositories/keyBuilder";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import { readValidTexts } from "../../fixtures/csvFixtures";

const GAME: GameDefinition = {
  id: "sample2024",
  displayName: "サンプルデータ",
  directory: "sample2024",
  bundled: true,
  note: "",
};

function createFetcher(files: Partial<Record<CsvKind, string>>, extra: Record<string, string> = {}) {
  const byFileName = new Map<string, string>();
  for (const kind of CSV_KINDS) {
    const text = files[kind];
    if (text !== undefined) byFileName.set(CSV_FILE_NAMES[kind], text);
  }
  for (const [name, text] of Object.entries(extra)) byFileName.set(name, text);

  const fetcher: CsvFetcher = (url) => {
    const fileName = url.split("/").pop() ?? "";
    const text = byFileName.get(fileName);
    if (text === undefined) {
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
  };
  return fetcher;
}

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe("dataUrl", () => {
  it("base 相対でCSVのURLを組み立てる", () => {
    expect(dataUrl("sample2024", "config", "./")).toBe("./data/sample2024/config.csv");
    expect(dataUrl("sample2024", "hint_rules", "/app")).toBe("/app/data/sample2024/hint_rules.csv");
  });
});

describe("loadGamesManifest", () => {
  it("BOM 付きの games.json を読み込める", async () => {
    const manifest = await loadGamesManifest({
      baseUrl: "./",
      fetcher: createFetcher(
        {},
        {
          "games.json": `\uFEFF{"games":[{"id":"a","displayName":"A","directory":"a","bundled":true,"note":""}],"defaultGameId":"a"}`,
        },
      ),
    });
    expect(manifest.defaultGameId).toBe("a");
    expect(manifest.games[0]?.id).toBe("a");
  });

  it("games.json が無ければ CSV_FILE_MISSING", async () => {
    const error = await captureError(
      loadGamesManifest({ baseUrl: "./", fetcher: createFetcher({}) }),
    );
    expect(error.code).toBe(ERROR_CODES.CSV_FILE_MISSING);
  });
});

describe("loadGameData", () => {
  it("UT-GAME-01: ゲーム切替後は切替先のCSVのみが参照される", async () => {
    const texts = readValidTexts();
    const gameA = await loadGameData(GAME, { baseUrl: "./", fetcher: createFetcher(texts) });

    const altTexts = { ...texts };
    altTexts.base_sense_plus = [
      "player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental",
      "pitcher,velocity,130,131,77,0,5,0,0",
    ].join("\n");
    const gameB = await loadGameData(
      { ...GAME, id: "alt2024", directory: "alt2024" },
      { baseUrl: "./", fetcher: createFetcher(altTexts) },
    );

    expect(gameA.baseSensePlus.get(baseKey("pitcher", "velocity", 130))?.cost.muscle).toBe(10);
    expect(gameB.baseSensePlus.get(baseKey("pitcher", "velocity", 130))?.cost.muscle).toBe(77);
    // ゲームAにしか存在しない行が残らないこと
    expect(gameA.baseSensePlus.has(baseKey("pitcher", "control", 40))).toBe(true);
    expect(gameB.baseSensePlus.has(baseKey("pitcher", "control", 40))).toBe(false);
    expect(gameB.gameId).toBe("alt2024");
  });

  it("UT-GAME-02: 必須ファイルが欠けると CSV_FILE_MISSING でロード中止", async () => {
    const texts: Partial<Record<CsvKind, string>> = { ...readValidTexts() };
    delete texts.hint_rules;
    const error = await captureError(
      loadGameData(GAME, { baseUrl: "./", fetcher: createFetcher(texts) }),
    );
    expect(error.code).toBe(ERROR_CODES.CSV_FILE_MISSING);
    expect(error.message).toContain("hint_rules.csv");
  });

  it("UT-GAME-03: 検証エラーがあればインデックスを構築せずロード中止", async () => {
    const texts = readValidTexts();
    texts.blue_abilities = [
      "ability_id,display_name,player_type,ability_type,from_state,to_state,hint_level,sense_mode,muscle,agility,technique,breaking,mental",
      "chance,チャンス,fielder,rank,G,E,0,normal,0,8,14,0,50",
    ].join("\n");
    const error = await captureError(
      loadGameData(GAME, { baseUrl: "./", fetcher: createFetcher(texts) }),
    );
    expect(error.code).toBe(ERROR_CODES.INVALID_CSV);
    const detail = error.detail as { issues: unknown[] } | undefined;
    expect(detail?.issues.length).toBeGreaterThan(0);
  });

  it("UT-GAME-04: 任意ファイルが無くても空データとして正常にロードされる", async () => {
    const texts: Partial<Record<CsvKind, string>> = { ...readValidTexts() };
    delete texts.breaking_cache_normal;
    delete texts.breaking_cache_sense_plus;
    const gameData = await loadGameData(GAME, { baseUrl: "./", fetcher: createFetcher(texts) });
    expect(gameData.breakingNormal.size).toBe(0);
    expect(gameData.breakingSensePlus.size).toBe(0);
  });

  it("UT-GAME-05: インポート上書きは種別単位で全置換される", async () => {
    const texts = readValidTexts();
    // 参照整合（V-19）は再構築後のデータセット全体に掛かるため、
    // gold_prerequisites.csv が参照する青特は上書き側にも含める
    const overrideCsv = [
      "ability_id,display_name,player_type,ability_type,from_state,to_state,hint_level,sense_mode,muscle,agility,technique,breaking,mental",
      "power_hitter,パワーヒッター,fielder,binary,NONE,ON,0,normal,1,2,3,4,5",
      "strikeout,奪三振,pitcher,binary,NONE,ON,0,normal,35,0,80,50,35",
      "chance,チャンス,fielder,rank,G,F,0,normal,0,8,14,0,50",
      "chance,チャンス,fielder,rank,F,E,0,normal,0,10,18,0,62",
      "chance,チャンス,fielder,rank,E,D,0,normal,0,13,22,0,80",
      "chance,チャンス,fielder,rank,D,C,0,normal,0,16,28,0,100",
      "chance,チャンス,fielder,rank,C,B,0,normal,0,20,35,0,125",
      "chance,チャンス,fielder,rank,B,A,0,normal,0,24,42,0,150",
    ].join("\n");
    const { issues, rows } = validateFile("blue_abilities", parseCsv(overrideCsv));
    expect(issues).toEqual([]);

    const gameData = await loadGameData(GAME, {
      baseUrl: "./",
      fetcher: createFetcher(texts),
      overrides: { blue_abilities: rows },
    });

    expect(gameData.blue.size).toBe(8);
    expect(
      gameData.blue.get(blueKey("power_hitter", "fielder", "NONE", 0, "normal"))?.cost.muscle,
    ).toBe(1);
    // 標準CSVの同種別行は1行も残らない（行単位のマージをしない）
    expect(gameData.blueIndex.has("average_hitter")).toBe(false);
    expect(gameData.blueIndex.has("test_round")).toBe(false);
    expect(gameData.blue.has(blueKey("chance", "fielder", "D", 1, "normal"))).toBe(false);
  });

  it("UT-GAME-06: 変化球キャッシュのみ追記マージされ、重複キーはユーザー登録分が優先される", async () => {
    const texts = readValidTexts();
    const gameData = await loadGameData(GAME, {
      baseUrl: "./",
      fetcher: createFetcher(texts),
      breakingCache: [
        {
          senseMode: "sense_plus",
          rows: [
            {
              pitchType: "slider",
              fromLevel: 1,
              toLevel: 2,
              totalBreakBefore: 1,
              pitchCountBefore: 1,
              cost: { muscle: 0, agility: 0, technique: 0, breaking: 999, mental: 0 },
            },
            {
              pitchType: "fork",
              fromLevel: 0,
              toLevel: 1,
              totalBreakBefore: 2,
              pitchCountBefore: 1,
              cost: { muscle: 0, agility: 0, technique: 30, breaking: 120, mental: 0 },
            },
          ],
        },
      ],
    });

    // 標準CSVの行は引ける
    expect(gameData.breakingSensePlus.get(breakingKey("curve", 0, 3, 1))?.cost.breaking).toBe(110);
    // ユーザー登録分も引ける
    expect(gameData.breakingSensePlus.get(breakingKey("fork", 0, 2, 1))?.cost.breaking).toBe(120);
    // キー重複はユーザー登録分が優先
    expect(gameData.breakingSensePlus.get(breakingKey("slider", 1, 1, 1))?.cost.breaking).toBe(999);
  });

  it("bundled: false でCSVが1件も配置されていなければ案内エラーにする", async () => {
    const error = await captureError(
      loadGameData(
        { ...GAME, id: "pawapro2024", directory: "pawapro2024", bundled: false },
        { baseUrl: "./", fetcher: createFetcher({}) },
      ),
    );
    expect(error.code).toBe(ERROR_CODES.GAME_DATA_NOT_DEPLOYED);
  });
});
