/**
 * インポートで上書きしたCSVデータの保存（06_persistence_spec.md §1・§2）。
 * 上書きは種別単位の全置換であり、行単位のマージは行わない。
 */
import type { CsvKind } from "../csv/schemas";
import type { ValidatedGameData } from "../csv/validators";
import type { OverrideKind, OverrideRecord } from "./db";
import { getDb, STORAGE_LOAD_MESSAGE, STORAGE_SAVE_MESSAGE, withStorageError } from "./db";

export function buildOverrideRecord<K extends CsvKind>(
  gameId: string,
  kind: K,
  rows: ValidatedGameData[K],
  fileName: string,
  importedAt = new Date().toISOString(),
): OverrideRecord {
  return { gameId, kind, rows, rowCount: rows.length, importedAt, fileName };
}

/** 保存済みレコードを loadGameData に渡せる形へ整える純粋関数。 */
export function toOverrideRows(records: OverrideRecord[]): Partial<ValidatedGameData> {
  // 検証済みの行のみが保存されるため、種別の型へそのまま復元する
  const overrides: Record<string, unknown[]> = {};
  for (const record of records) {
    overrides[record.kind] = record.rows;
  }
  return overrides as Partial<ValidatedGameData>;
}

export async function saveOverride<K extends CsvKind>(
  gameId: string,
  kind: K,
  rows: ValidatedGameData[K],
  fileName: string,
  importedAt = new Date().toISOString(),
): Promise<OverrideRecord> {
  const record = buildOverrideRecord(gameId, kind, rows, fileName, importedAt);
  await withStorageError(async () => {
    const db = await getDb();
    await db.put("overrides", record);
  }, STORAGE_SAVE_MESSAGE);
  return record;
}

export async function listOverrides(gameId: string): Promise<OverrideRecord[]> {
  return withStorageError(async () => {
    const db = await getDb();
    const records = await db.getAll("overrides");
    return records.filter((record) => record.gameId === gameId);
  }, STORAGE_LOAD_MESSAGE);
}

export async function loadOverrideRows(gameId: string): Promise<Partial<ValidatedGameData>> {
  return toOverrideRows(await listOverrides(gameId));
}

export async function clearOverride(gameId: string, kind: OverrideKind): Promise<void> {
  await withStorageError(async () => {
    const db = await getDb();
    await db.delete("overrides", [gameId, kind]);
  }, STORAGE_SAVE_MESSAGE);
}

export async function clearAllOverrides(gameId: string): Promise<void> {
  const records = await listOverrides(gameId);
  for (const record of records) {
    await clearOverride(gameId, record.kind);
  }
}
