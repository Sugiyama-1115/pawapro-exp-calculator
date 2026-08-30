/**
 * 変化球共通キャッシュへのユーザー追記分（06_persistence_spec.md §1・§2）。
 * 標準CSVへ追記マージされ、キー重複時は本ストアの値が優先される。
 */
import type { BreakingCacheRow, SenseMode } from "@/domain/models/ability";
import { breakingKey } from "../repositories/keyBuilder";
import type { BreakingCacheRecord } from "./db";
import { getDb, STORAGE_LOAD_MESSAGE, STORAGE_SAVE_MESSAGE, withStorageError } from "./db";

export function toCacheRecord(
  gameId: string,
  senseMode: SenseMode,
  row: BreakingCacheRow,
  registeredAt = new Date().toISOString(),
): BreakingCacheRecord {
  return {
    gameId,
    senseMode,
    cacheKey: breakingKey(row.pitchType, row.fromLevel, row.totalBreakBefore, row.pitchCountBefore),
    row,
    registeredAt,
  };
}

export async function saveBreakingCacheRows(
  gameId: string,
  senseMode: SenseMode,
  rows: BreakingCacheRow[],
  registeredAt = new Date().toISOString(),
): Promise<void> {
  await withStorageError(async () => {
    const db = await getDb();
    const tx = db.transaction("breakingCache", "readwrite");
    for (const row of rows) {
      await tx.store.put(toCacheRecord(gameId, senseMode, row, registeredAt));
    }
    await tx.done;
  }, STORAGE_SAVE_MESSAGE);
}

export async function listBreakingCacheRows(
  gameId: string,
  senseMode: SenseMode,
): Promise<BreakingCacheRow[]> {
  return withStorageError(async () => {
    const db = await getDb();
    const records = await db.getAllFromIndex("breakingCache", "by_game", [gameId, senseMode]);
    return records.map((record) => record.row);
  }, STORAGE_LOAD_MESSAGE);
}

/** loadGameData の breakingCache オプションへそのまま渡せる形で取得する。 */
export async function loadBreakingCacheEntries(
  gameId: string,
): Promise<{ senseMode: SenseMode; rows: BreakingCacheRow[] }[]> {
  const modes: SenseMode[] = ["normal", "sense_plus"];
  const entries: { senseMode: SenseMode; rows: BreakingCacheRow[] }[] = [];
  for (const senseMode of modes) {
    const rows = await listBreakingCacheRows(gameId, senseMode);
    if (rows.length > 0) entries.push({ senseMode, rows });
  }
  return entries;
}

export async function clearBreakingCache(gameId: string, senseMode: SenseMode): Promise<void> {
  await withStorageError(async () => {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex("breakingCache", "by_game", [gameId, senseMode]);
    const tx = db.transaction("breakingCache", "readwrite");
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  }, STORAGE_SAVE_MESSAGE);
}
