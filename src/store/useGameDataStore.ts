/**
 * ゲームデータのロード状態（02_architecture.md §6）。
 * 検証・インデックス構築は data 層に委ね、本ストアは状態保持と呼び出し順の制御のみを行う。
 * 計算式・検証ルールをここに書いてはならない。
 */
import { create } from "zustand";
import { parseCsv } from "@/data/csv/csvParser";
import type { CsvKind } from "@/data/csv/schemas";
import { CSV_FILE_NAMES } from "@/data/csv/schemas";
import type { ValidatedGameData } from "@/data/csv/validators";
import { validateFile } from "@/data/csv/validators";
import { loadBreakingCacheEntries } from "@/data/persistence/breakingCacheRepository";
import type { OverrideRecord } from "@/data/persistence/db";
import { getAppState, setAppState } from "@/data/persistence/db";
import {
  buildOverrideRecord,
  clearOverride as clearOverrideRecord,
  listOverrides,
  saveOverride,
  toOverrideRows,
} from "@/data/persistence/overrideRepository";
import type { GameDefinition } from "@/data/repositories/gameDataLoader";
import { loadGameData, loadGamesManifest } from "@/data/repositories/gameDataLoader";
import type { BreakingCacheRow, SenseMode } from "@/domain/models/ability";
import { AppError, type ValidationIssue } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { GameDataSet } from "@/domain/models/gameData";

// ui 層は store のみに依存する（02_architecture.md §1）。UI が必要とする型・定数はここで中継する。
export { CSV_KINDS } from "@/data/csv/schemas";
export type { CsvKind } from "@/data/csv/schemas";
export type { GameDefinition } from "@/data/repositories/gameDataLoader";
export type { ValidationIssue } from "@/domain/errors/appError";

export type GameDataStatus = "idle" | "loading" | "ready" | "error";

export interface LoadErrorState {
  code: string;
  message: string;
  issues: ValidationIssue[];
  /** 表示上限（200件）を超えて切り捨てた件数。 */
  omittedCount: number;
}

export type ImportOutcome =
  | { ok: true; rowCount: number }
  | { ok: false; message: string; issues: ValidationIssue[] };

/** 読み込み済み行数の内訳（05_ui_spec.md §3.1・UI-T1-03）。 */
export interface RowCountEntry {
  kind: CsvKind;
  label: string;
  count: number;
}

interface GameDataState {
  status: GameDataStatus;
  games: GameDefinition[];
  defaultGameId: string;
  gameId: string | null;
  gameData: GameDataSet | null;
  loadError: LoadErrorState | null;
  overrides: OverrideRecord[];
  storageWarning: string | null;

  initialize(): Promise<void>;
  loadGame(gameId: string): Promise<void>;
  importCsv(kind: CsvKind, fileName: string, text: string): Promise<ImportOutcome>;
  clearOverride(kind: CsvKind): Promise<void>;
  dismissWarning(): void;
}

/** 現在選択中のゲーム定義。未選択・未知IDのときは null。 */
export function selectCurrentGame(state: {
  games: GameDefinition[];
  gameId: string | null;
}): GameDefinition | null {
  return state.games.find((game) => game.id === state.gameId) ?? null;
}

/**
 * サンプルデータ（リポジトリ同梱データ）かどうか。
 * ゲームIDをコードに書くと新ゲーム追加時に src の変更が必要になるため、
 * games.json の bundled フラグのみで判定する（AT-19）。
 */
export function isSampleGame(game: GameDefinition | null): boolean {
  return game?.bundled === true;
}

/**
 * インデックスから復元できる範囲での読み込み行数の内訳。
 * config はキー・値の設定であり行数を示す意味が薄いため対象外とする。
 */
export function describeRowCounts(gameData: GameDataSet): RowCountEntry[] {
  let prereqCount = 0;
  for (const list of gameData.goldPrereq.values()) prereqCount += list.length;
  const counts: [CsvKind, number][] = [
    ["base_ability_defs", gameData.baseDefList.length],
    ["base_sense_plus", gameData.baseSensePlus.size],
    ["base_normal", gameData.baseNormal.size],
    ["blue_abilities", gameData.blue.size],
    ["gold_abilities", gameData.gold.size],
    ["gold_prerequisites", prereqCount],
    ["hint_rules", gameData.hintRules.size],
    ["breaking_cache_sense_plus", gameData.breakingSensePlus.size],
    ["breaking_cache_normal", gameData.breakingNormal.size],
  ];
  return counts.map(([kind, count]) => ({ kind, label: CSV_FILE_NAMES[kind], count }));
}

function toLoadError(error: unknown): LoadErrorState {
  if (error instanceof AppError) {
    const detail = error.detail ?? {};
    const issues = Array.isArray(detail.issues) ? (detail.issues as ValidationIssue[]) : [];
    const omittedCount = typeof detail.omittedCount === "number" ? detail.omittedCount : 0;
    return { code: error.code, message: error.message, issues, omittedCount };
  }
  return {
    code: ERROR_CODES.INVALID_CSV,
    message: error instanceof Error ? error.message : String(error),
    issues: [],
    omittedCount: 0,
  };
}

export const useGameDataStore = create<GameDataState>((set, get) => {
  /**
   * 永続化の失敗で計算を止めないためのラッパ。
   * 握りつぶさず storageWarning として画面へ到達させる（07_error_spec.md §4）。
   */
  async function safeStorage<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      set({ storageWarning: error instanceof AppError ? error.message : String(error) });
      return fallback;
    }
  }

  async function readOverrides(gameId: string): Promise<OverrideRecord[]> {
    return safeStorage(() => listOverrides(gameId), []);
  }

  async function readBreakingCache(
    gameId: string,
  ): Promise<{ senseMode: SenseMode; rows: BreakingCacheRow[] }[]> {
    return safeStorage(() => loadBreakingCacheEntries(gameId), []);
  }

  return {
    status: "idle",
    games: [],
    defaultGameId: "",
    gameId: null,
    gameData: null,
    loadError: null,
    overrides: [],
    storageWarning: null,

    async initialize(): Promise<void> {
      set({ status: "loading", loadError: null });
      let manifest;
      try {
        manifest = await loadGamesManifest();
      } catch (error) {
        set({ status: "error", loadError: toLoadError(error) });
        return;
      }
      set({ games: manifest.games, defaultGameId: manifest.defaultGameId });
      const lastGameId = await safeStorage(() => getAppState<string>("lastGameId"), null);
      const gameId =
        lastGameId !== null && manifest.games.some((game) => game.id === lastGameId)
          ? lastGameId
          : manifest.defaultGameId;
      await get().loadGame(gameId);
    },

    async loadGame(gameId: string): Promise<void> {
      const game = get().games.find((entry) => entry.id === gameId);
      if (!game) {
        set({
          status: "error",
          gameId,
          gameData: null,
          loadError: {
            code: ERROR_CODES.CSV_FILE_MISSING,
            message: `ゲーム「${gameId}」が games.json に定義されていません。`,
            issues: [],
            omittedCount: 0,
          },
        });
        return;
      }
      set({ status: "loading", gameId, gameData: null, loadError: null });
      const overrides = await readOverrides(gameId);
      const breakingCache = await readBreakingCache(gameId);
      try {
        const gameData = await loadGameData(game, {
          overrides: toOverrideRows(overrides),
          breakingCache,
        });
        set({ status: "ready", gameData, overrides, loadError: null });
      } catch (error) {
        set({ status: "error", gameData: null, overrides, loadError: toLoadError(error) });
      }
      await safeStorage(() => setAppState("lastGameId", gameId), undefined);
    },

    async importCsv(kind: CsvKind, fileName: string, text: string): Promise<ImportOutcome> {
      const state = get();
      const game = selectCurrentGame(state);
      if (!game) {
        return {
          ok: false,
          message: "ゲームが選択されていません。",
          issues: [],
        };
      }

      const validation = validateFile(kind, parseCsv(text), fileName);
      if (validation.issues.length > 0) {
        return { ok: false, message: rejectionMessage(validation.issues.length), issues: validation.issues };
      }

      // 参照整合（V-18〜V-22）はデータセット全体でしか判定できないため、
      // 上書き後のデータで再構築を試み、失敗したら一切適用しない（06_persistence_spec.md §5.1）。
      const candidate: Partial<ValidatedGameData> = {
        ...toOverrideRows(state.overrides),
        [kind]: validation.rows,
      };
      const breakingCache = await readBreakingCache(game.id);
      let gameData: GameDataSet;
      try {
        gameData = await loadGameData(game, { overrides: candidate, breakingCache });
      } catch (error) {
        const failure = toLoadError(error);
        const issues =
          failure.issues.length > 0
            ? failure.issues
            : [
                {
                  code: failure.code,
                  file: fileName,
                  line: null,
                  column: null,
                  message: failure.message,
                },
              ];
        return { ok: false, message: rejectionMessage(issues.length), issues };
      }

      const importedAt = new Date().toISOString();
      const record = await safeStorage(
        () => saveOverride(game.id, kind, validation.rows, fileName, importedAt),
        buildOverrideRecord(game.id, kind, validation.rows, fileName, importedAt),
      );
      set({
        status: "ready",
        gameData,
        loadError: null,
        overrides: [...state.overrides.filter((entry) => entry.kind !== kind), record],
      });
      return { ok: true, rowCount: validation.rows.length };
    },

    async clearOverride(kind: CsvKind): Promise<void> {
      const gameId = get().gameId;
      if (gameId === null) return;
      await safeStorage(() => clearOverrideRecord(gameId, kind), undefined);
      await get().loadGame(gameId);
    },

    dismissWarning(): void {
      set({ storageWarning: null });
    },
  };
});

function rejectionMessage(count: number): string {
  return `インポートは適用されませんでした。以下のエラーを修正してください（${count}件）。`;
}
