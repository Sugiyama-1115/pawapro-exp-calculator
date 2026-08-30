/**
 * 永続化層のうち、IndexedDB を必要としない整形・移行処理の単体テスト。
 * IndexedDB 本体の読み書きは E2E（M12）で検証する。
 */
import { describe, expect, it } from "vitest";
import { validateFile } from "@/data/csv/validators";
import { parseCsv } from "@/data/csv/csvParser";
import { toCacheRecord } from "@/data/persistence/breakingCacheRepository";
import { SCHEMA_VERSION, type StoredPlan } from "@/data/persistence/db";
import { buildOverrideRecord, toOverrideRows } from "@/data/persistence/overrideRepository";
import {
  createPlanId,
  duplicatePlanData,
  migrateStoredPlan,
  toStoredPlan,
  toSummary,
} from "@/data/persistence/planRepository";
import type { PlayerPlan } from "@/domain/models/plan";

const PLAN: PlayerPlan = {
  id: "plan-1",
  name: "テスト野手",
  gameId: "sample2024",
  playerType: "fielder",
  senseMode: "normal",
  currentBase: { contact: 40 },
  targetBase: { contact: 45 },
  blueTargets: [],
  goldTargets: [],
  breakingPlan: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("planRepository", () => {
  it("保存形式にスキーマ版を付与する", () => {
    expect(toStoredPlan(PLAN).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("現行スキーマのレコードはそのまま読み込める", () => {
    const restored = migrateStoredPlan(toStoredPlan(PLAN));
    expect(restored).toEqual(PLAN);
    expect(restored).not.toHaveProperty("schemaVersion");
  });

  it("変換関数の無いバージョンは読み込まず null を返す", () => {
    const legacy: StoredPlan = { ...PLAN, schemaVersion: 0 };
    const future: StoredPlan = { ...PLAN, schemaVersion: SCHEMA_VERSION + 1 };
    expect(migrateStoredPlan(legacy)).toBeNull();
    expect(migrateStoredPlan(future)).toBeNull();
  });

  it("複製は新しい id と作成日時を持つ別プランになる", () => {
    const copy = duplicatePlanData(PLAN, "plan-2", "2026-08-30T00:00:00.000Z");
    expect(copy.id).toBe("plan-2");
    expect(copy.name).toBe("テスト野手 のコピー");
    expect(copy.createdAt).toBe("2026-08-30T00:00:00.000Z");
    expect(copy.updatedAt).toBe("2026-08-30T00:00:00.000Z");
    // 元プランを破壊しない
    expect(PLAN.id).toBe("plan-1");
  });

  it("一覧用サマリーは必要な項目のみを持つ", () => {
    expect(toSummary(toStoredPlan(PLAN))).toEqual({
      id: "plan-1",
      name: "テスト野手",
      gameId: "sample2024",
      playerType: "fielder",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  });

  it("プランIDは重複しない値を採番する", () => {
    expect(createPlanId()).not.toBe(createPlanId());
  });
});

describe("overrideRepository", () => {
  const overrideCsv = [
    "ability_id,display_name,player_type,ability_type,from_state,to_state,hint_level,sense_mode,muscle,agility,technique,breaking,mental",
    "power_hitter,パワーヒッター,fielder,binary,NONE,ON,0,normal,1,2,3,4,5",
  ].join("\n");

  it("インポート結果を種別単位のレコードにする", () => {
    const { rows } = validateFile("blue_abilities", parseCsv(overrideCsv));
    const record = buildOverrideRecord(
      "sample2024",
      "blue_abilities",
      rows,
      "blue_abilities.csv",
      "2026-08-30T00:00:00.000Z",
    );
    expect(record.rowCount).toBe(1);
    expect(record.kind).toBe("blue_abilities");
    expect(record.importedAt).toBe("2026-08-30T00:00:00.000Z");
  });

  it("保存済みレコードをロード用の上書きデータへ復元する", () => {
    const { rows } = validateFile("blue_abilities", parseCsv(overrideCsv));
    const overrides = toOverrideRows([
      buildOverrideRecord("sample2024", "blue_abilities", rows, "blue_abilities.csv"),
    ]);
    expect(overrides.blue_abilities).toHaveLength(1);
    expect(overrides.gold_abilities).toBeUndefined();
  });
});

describe("breakingCacheRepository", () => {
  it("キャッシュキーは breakingKey と同じ形式で採番される", () => {
    const record = toCacheRecord(
      "sample2024",
      "sense_plus",
      {
        pitchType: "slider",
        fromLevel: 2,
        toLevel: 3,
        totalBreakBefore: 5,
        pitchCountBefore: 2,
        cost: { muscle: 0, agility: 0, technique: 12, breaking: 60, mental: 0 },
      },
      "2026-08-30T00:00:00.000Z",
    );
    expect(record.cacheKey).toBe("slider|2|5|2");
    expect(record.gameId).toBe("sample2024");
    expect(record.senseMode).toBe("sense_plus");
  });
});
