/**
 * プランのCRUD（06_persistence_spec.md §1・§3）。
 * 純粋な整形・移行処理は関数として切り出し、IndexedDB へのアクセスと分離する。
 */
import type { PlayerPlan } from "@/domain/models/plan";
import type { StoredPlan } from "./db";
import {
  getDb,
  SCHEMA_VERSION,
  STORAGE_LOAD_MESSAGE,
  STORAGE_SAVE_MESSAGE,
  withStorageError,
} from "./db";

export interface PlanSummary {
  id: string;
  name: string;
  gameId: string;
  playerType: PlayerPlan["playerType"];
  createdAt: string;
  updatedAt: string;
}

/**
 * 旧スキーマからの変換表。変換関数が無いバージョンは読み込まない
 * （黙って壊れたデータを読み込まないこと。06_persistence_spec.md §1）。
 */
const PLAN_MIGRATIONS: Record<number, (plan: StoredPlan) => StoredPlan> = {};

export function createPlanId(): string {
  const globalCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `plan-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function toStoredPlan(plan: PlayerPlan): StoredPlan {
  return { ...plan, schemaVersion: SCHEMA_VERSION };
}

export function toSummary(plan: StoredPlan): PlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    gameId: plan.gameId,
    playerType: plan.playerType,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/** 対応できないバージョンは null を返し、当該プランのみスキップする。 */
export function migrateStoredPlan(record: StoredPlan): PlayerPlan | null {
  let current = record;
  let guard = 0;
  while (current.schemaVersion < SCHEMA_VERSION) {
    const migrate = PLAN_MIGRATIONS[current.schemaVersion];
    if (!migrate || guard++ > SCHEMA_VERSION) return null;
    current = migrate(current);
  }
  if (current.schemaVersion !== SCHEMA_VERSION) return null;
  return stripSchemaVersion(current);
}

/** 保存用のメタ情報を落として PlayerPlan に戻す。 */
function stripSchemaVersion(record: StoredPlan): PlayerPlan {
  return {
    id: record.id,
    name: record.name,
    gameId: record.gameId,
    playerType: record.playerType,
    senseMode: record.senseMode,
    currentBase: record.currentBase,
    targetBase: record.targetBase,
    blueTargets: record.blueTargets,
    goldTargets: record.goldTargets,
    breakingPlan: record.breakingPlan,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** 複製プラン（新しい id と作成日時を持つ別プラン）を作る純粋関数。 */
export function duplicatePlanData(plan: PlayerPlan, newId: string, now: string): PlayerPlan {
  return {
    ...plan,
    id: newId,
    name: `${plan.name} のコピー`,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listPlanSummaries(): Promise<PlanSummary[]> {
  return withStorageError(async () => {
    const db = await getDb();
    const records = await db.getAll("plans");
    return records
      .map((record) => migrateStoredPlan(record))
      .filter((plan): plan is PlayerPlan => plan !== null)
      .map((plan) => toSummary(toStoredPlan(plan)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, STORAGE_LOAD_MESSAGE);
}

export async function getPlan(id: string): Promise<PlayerPlan | null> {
  return withStorageError(async () => {
    const db = await getDb();
    const record = await db.get("plans", id);
    return record === undefined ? null : migrateStoredPlan(record);
  }, STORAGE_LOAD_MESSAGE);
}

export async function savePlan(plan: PlayerPlan, now = new Date().toISOString()): Promise<PlayerPlan> {
  const updated: PlayerPlan = { ...plan, updatedAt: now };
  await withStorageError(async () => {
    const db = await getDb();
    await db.put("plans", toStoredPlan(updated));
  }, STORAGE_SAVE_MESSAGE);
  return updated;
}

export async function duplicatePlan(
  id: string,
  newId = createPlanId(),
  now = new Date().toISOString(),
): Promise<PlayerPlan | null> {
  const source = await getPlan(id);
  if (!source) return null;
  const copy = duplicatePlanData(source, newId, now);
  await withStorageError(async () => {
    const db = await getDb();
    await db.put("plans", toStoredPlan(copy));
  }, STORAGE_SAVE_MESSAGE);
  return copy;
}

export async function deletePlan(id: string): Promise<void> {
  await withStorageError(async () => {
    const db = await getDb();
    await db.delete("plans", id);
  }, STORAGE_SAVE_MESSAGE);
}
