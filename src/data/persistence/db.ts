/**
 * IndexedDB スキーマ定義（06_persistence_spec.md §1）。
 * 読み書きの失敗は AppError(STORAGE_ERROR) に変換し、握りつぶさない（07_error_spec.md §4）。
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { BreakingCacheRow, SenseMode } from "@/domain/models/ability";
import type { PlayerPlan } from "@/domain/models/plan";
import type { CsvKind } from "../csv/schemas";

export const DB_NAME = "pawapro-exp-calculator";
export const DB_VERSION = 1;
/** 保存データのスキーマ版（appState.schemaVersion / plans.schemaVersion）。 */
export const SCHEMA_VERSION = 1;

export const STORAGE_SAVE_MESSAGE =
  "保存に失敗しました。ブラウザの保存容量が不足している可能性があります。入力内容は画面上に保持されています。";
export const STORAGE_LOAD_MESSAGE = "保存データの読み込みに失敗しました。";

/** インポートで上書きできる種別。CSVの種別と1対1で対応する。 */
export type OverrideKind = CsvKind;

export interface OverrideRecord {
  gameId: string;
  kind: OverrideKind;
  rows: unknown[];
  rowCount: number;
  importedAt: string;
  fileName: string;
}

export interface BreakingCacheRecord {
  gameId: string;
  senseMode: SenseMode;
  cacheKey: string;
  row: BreakingCacheRow;
  registeredAt: string;
}

export interface StoredPlan extends PlayerPlan {
  schemaVersion: number;
}

export interface AppStateRecord {
  key: string;
  value: unknown;
}

export interface PawaproDB extends DBSchema {
  plans: {
    key: string;
    value: StoredPlan;
    indexes: { by_updatedAt: string; by_gameId: string };
  };
  overrides: {
    key: [string, string];
    value: OverrideRecord;
  };
  breakingCache: {
    key: [string, string, string];
    value: BreakingCacheRecord;
    indexes: { by_game: [string, string] };
  };
  appState: {
    key: string;
    value: AppStateRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<PawaproDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PawaproDB>> {
  dbPromise ??= openDB<PawaproDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("plans")) {
        const plans = db.createObjectStore("plans", { keyPath: "id" });
        plans.createIndex("by_updatedAt", "updatedAt");
        plans.createIndex("by_gameId", "gameId");
      }
      if (!db.objectStoreNames.contains("overrides")) {
        db.createObjectStore("overrides", { keyPath: ["gameId", "kind"] });
      }
      if (!db.objectStoreNames.contains("breakingCache")) {
        const cache = db.createObjectStore("breakingCache", {
          keyPath: ["gameId", "senseMode", "cacheKey"],
        });
        cache.createIndex("by_game", ["gameId", "senseMode"]);
      }
      if (!db.objectStoreNames.contains("appState")) {
        db.createObjectStore("appState", { keyPath: "key" });
      }
    },
  });
  return dbPromise;
}

/** テスト・全消去後に接続を張り直すためのリセット。 */
export function resetDbConnection(): void {
  dbPromise = null;
}

export async function withStorageError<T>(
  operation: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new AppError(ERROR_CODES.STORAGE_ERROR, message, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getAppState<T>(key: string): Promise<T | null> {
  return withStorageError(async () => {
    const db = await getDb();
    const record = await db.get("appState", key);
    return record === undefined ? null : (record.value as T);
  }, STORAGE_LOAD_MESSAGE);
}

export async function setAppState(key: string, value: unknown): Promise<void> {
  await withStorageError(async () => {
    const db = await getDb();
    await db.put("appState", { key, value });
  }, STORAGE_SAVE_MESSAGE);
}
