import { describe, expect, it } from "vitest";
import { RESULT_CSV_COLUMNS } from "@/data/csv/schemas";
import {
  BOM,
  buildBreakingCacheCsv,
  buildExportFileName,
  buildGoldAbilitiesCsv,
  buildPlanJson,
  buildResultCsv,
  buildResultJson,
  formatTimestamp,
  sanitizeFileName,
} from "@/data/persistence/exporter";
import type { ExpVector } from "@/domain/models/expVector";
import type { PlayerPlan } from "@/domain/models/plan";
import type { CalculationResult } from "@/domain/models/result";

const v = (
  muscle: number,
  agility: number,
  technique: number,
  breaking: number,
  mental: number,
): ExpVector => ({ muscle, agility, technique, breaking, mental });

const RESULT: CalculationResult = {
  total: v(969, 0, 659, 1280, 125),
  subtotal: {
    base: v(900, 0, 500, 0, 0),
    blue: v(25, 0, 57, 0, 25),
    gold: v(44, 0, 102, 0, 0),
    breaking: v(0, 0, 0, 1280, 100),
  },
  base: [
    {
      category: "base",
      id: "velocity",
      displayName: "球速",
      detail: "130 → 155",
      cost: v(900, 0, 500, 0, 0),
      source: "master",
      autoAdded: false,
    },
  ],
  blue: [
    {
      category: "blue",
      id: "strikeout",
      displayName: "奪三振",
      detail: "NONE → ON / コツLv3",
      cost: v(25, 0, 57, 0, 25),
      source: "master",
      autoAdded: false,
    },
  ],
  gold: [
    {
      category: "gold",
      id: "doctor_k",
      displayName: "ドクターK",
      detail: "コツLv4",
      cost: v(44, 0, 102, 0, 0),
      source: "estimated",
      autoAdded: false,
    },
  ],
  breaking: [
    {
      category: "breaking",
      id: "breaking_total",
      displayName: "変化球",
      detail: "スライダー4 / カーブ3, フォーク5",
      cost: v(0, 0, 0, 1280, 100),
      source: "manual",
      autoAdded: false,
    },
  ],
  status: "estimated",
  issues: [],
};

const PLAN: PlayerPlan = {
  id: "plan-1",
  name: "テスト投手",
  gameId: "sample2024",
  playerType: "pitcher",
  senseMode: "sense_plus",
  currentBase: { velocity: 130 },
  targetBase: { velocity: 155 },
  blueTargets: [],
  goldTargets: [],
  breakingPlan: null,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

function csvLines(csv: string): string[] {
  return csv.replace(BOM, "").split("\r\n");
}

describe("buildResultCsv", () => {
  it("UT-EXP-01: 計算結果CSVの列構成が仕様と一致する", () => {
    expect(csvLines(buildResultCsv(RESULT))[0]).toBe(RESULT_CSV_COLUMNS.join(","));
    expect(csvLines(buildResultCsv(RESULT))[0]).toBe(
      "category,id,display_name,detail,source,muscle,agility,technique,breaking,mental",
    );
  });

  it("UT-EXP-02: CSV出力にBOMが付与される", () => {
    expect(buildResultCsv(RESULT).startsWith("﻿")).toBe(true);
    expect(buildBreakingCacheCsv([]).startsWith("﻿")).toBe(true);
    expect(buildGoldAbilitiesCsv([]).startsWith("﻿")).toBe(true);
  });

  it("UT-EXP-05: 小計4行と合計1行が含まれる", () => {
    const lines = csvLines(buildResultCsv(RESULT));
    const subtotals = lines.filter((line) => line.startsWith("subtotal,"));
    const totals = lines.filter((line) => line.startsWith("total,"));
    expect(subtotals).toHaveLength(4);
    expect(totals).toHaveLength(1);
    expect(subtotals[0]).toBe("subtotal,base,基礎能力小計,,,900,0,500,0,0");
    expect(totals[0]).toBe("total,total,合計,,,969,0,659,1280,125");
  });

  it("明細行はカテゴリ順に並び、カンマを含む値は引用符で囲む", () => {
    const lines = csvLines(buildResultCsv(RESULT));
    expect(lines[1]).toBe("base,velocity,球速,130 → 155,master,900,0,500,0,0");
    expect(lines[4]).toContain('"スライダー4 / カーブ3, フォーク5"');
  });
});

describe("buildResultJson / buildPlanJson", () => {
  it("UT-EXP-03: プランJSONのラッパを持つ", () => {
    const json = buildPlanJson(PLAN, new Date("2026-08-30T14:22:31.000Z"));
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.format).toBe("pawapro-exp-calculator/plan");
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.exportedAt).toBe("2026-08-30T14:22:31.000Z");
    expect((parsed.plan as PlayerPlan).id).toBe("plan-1");
    // BOM 無し・2スペースインデント
    expect(json.startsWith("{")).toBe(true);
    expect(json).toContain('\n  "format"');
  });

  it("計算結果JSONは結果オブジェクトをそのまま出力する", () => {
    const parsed = JSON.parse(buildResultJson(RESULT)) as CalculationResult;
    expect(parsed.total).toEqual(RESULT.total);
    expect(parsed.status).toBe("estimated");
  });
});

describe("ファイル名", () => {
  it("UT-EXP-04: 禁止文字が _ に置換される", () => {
    expect(sanitizeFileName("a/b:c")).toBe("a_b_c");
    expect(sanitizeFileName('a\\b*c?d"e<f>g|h')).toBe("a_b_c_d_e_f_g_h");
  });

  it("タイムスタンプは YYYYMMDD_HHmmss 形式", () => {
    expect(formatTimestamp(new Date(2026, 7, 30, 14, 22, 31))).toBe("20260830_142231");
  });

  it("エクスポートのファイル名を組み立てる", () => {
    expect(buildExportFileName("plan", "投手/A", "json", new Date(2026, 7, 30, 14, 22, 31))).toBe(
      "plan_投手_A_20260830_142231.json",
    );
  });
});

describe("実測値CSV", () => {
  it("変化球キャッシュCSVは breaking_cache_*.csv と同じ列順で出力する", () => {
    const csv = buildBreakingCacheCsv([
      {
        pitchType: "slider",
        fromLevel: 1,
        toLevel: 2,
        totalBreakBefore: 1,
        pitchCountBefore: 1,
        cost: v(0, 0, 10, 50, 0),
      },
    ]);
    const lines = csvLines(csv);
    expect(lines[0]).toBe(
      "pitch_type,from_level,to_level,total_break_before,pitch_count_before,muscle,agility,technique,breaking,mental",
    );
    expect(lines[1]).toBe("slider,1,2,1,1,0,0,10,50,0");
  });

  it("金特実測値CSVは data_type=measured を付けて出力する", () => {
    const csv = buildGoldAbilitiesCsv([
      {
        abilityId: "archartist",
        displayName: "アーチスト",
        playerType: "fielder",
        hintLevel: 1,
        senseMode: "sense_plus",
        cost: v(100, 10, 50, 0, 20),
      },
    ]);
    const lines = csvLines(csv);
    expect(lines[0]).toBe(
      "ability_id,display_name,player_type,hint_level,sense_mode,muscle,agility,technique,breaking,mental,data_type",
    );
    expect(lines[1]).toBe("archartist,アーチスト,fielder,1,sense_plus,100,10,50,0,20,measured");
  });
});
