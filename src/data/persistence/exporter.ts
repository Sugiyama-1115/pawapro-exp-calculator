/**
 * エクスポート（06_persistence_spec.md §4）。
 * 整形処理は純粋関数として切り出し、ブラウザのダウンロード操作のみ副作用を持つ。
 */
import type { BreakingCacheRow, GoldAbilityRow } from "@/domain/models/ability";
import { EXP_KEYS } from "@/domain/models/expVector";
import type { PlayerPlan } from "@/domain/models/plan";
import type { CalculationResult, ItemCategory } from "@/domain/models/result";
import { ITEM_CATEGORIES } from "@/domain/models/result";
import { CSV_COLUMNS, RESULT_CSV_COLUMNS } from "../csv/schemas";

/** Excel での文字化けを防ぐため CSV は UTF-8 BOM 付きで出力する。 */
export const BOM = "﻿";

export const PLAN_EXPORT_FORMAT = "pawapro-exp-calculator/plan";
export const PLAN_EXPORT_FORMAT_VERSION = 1;

export interface PlanExportEnvelope {
  format: string;
  formatVersion: number;
  exportedAt: string;
  plan: PlayerPlan;
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  base: "基礎能力",
  blue: "青特殊能力",
  gold: "金特殊能力",
  breaking: "変化球",
};

/** ファイル名に使えない文字（\ / : * ? " < > |）を `_` へ置換する。 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

/** `YYYYMMDD_HHmmss`（ローカル時刻）。 */
export function formatTimestamp(date: Date): string {
  const pad = (value: number, length = 2): string => String(value).padStart(length, "0");
  return (
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function buildExportFileName(
  prefix: string,
  label: string,
  extension: string,
  date: Date,
): string {
  return `${prefix}_${sanitizeFileName(label)}_${formatTimestamp(date)}.${extension}`;
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvText(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** 計算結果CSV（06_persistence_spec.md §4.1）。明細 + 小計4行 + 合計1行。 */
export function buildResultCsv(result: CalculationResult): string {
  const rows: string[][] = [[...RESULT_CSV_COLUMNS]];

  for (const category of ITEM_CATEGORIES) {
    for (const item of result[category]) {
      rows.push([
        item.category,
        item.id,
        item.displayName,
        item.detail,
        item.source,
        ...EXP_KEYS.map((key) => String(item.cost[key])),
      ]);
    }
  }

  for (const category of ITEM_CATEGORIES) {
    rows.push([
      "subtotal",
      category,
      `${CATEGORY_LABELS[category]}小計`,
      "",
      "",
      ...EXP_KEYS.map((key) => String(result.subtotal[category][key])),
    ]);
  }

  rows.push([
    "total",
    "total",
    "合計",
    "",
    "",
    ...EXP_KEYS.map((key) => String(result.total[key])),
  ]);

  return BOM + toCsvText(rows);
}

export function buildResultJson(result: CalculationResult): string {
  return JSON.stringify(result, null, 2);
}

export function buildPlanEnvelope(plan: PlayerPlan, exportedAt: Date): PlanExportEnvelope {
  return {
    format: PLAN_EXPORT_FORMAT,
    formatVersion: PLAN_EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    plan,
  };
}

/** プランJSON。BOM 無し・2スペースインデント。 */
export function buildPlanJson(plan: PlayerPlan, exportedAt: Date): string {
  return JSON.stringify(buildPlanEnvelope(plan, exportedAt), null, 2);
}

/** 変化球実測値CSV。列順は breaking_cache_*.csv と同一。 */
export function buildBreakingCacheCsv(rows: BreakingCacheRow[]): string {
  const header = CSV_COLUMNS.breaking_cache_sense_plus;
  const body = rows.map((row) => [
    row.pitchType,
    String(row.fromLevel),
    String(row.toLevel),
    String(row.totalBreakBefore),
    String(row.pitchCountBefore),
    ...EXP_KEYS.map((key) => String(row.cost[key])),
  ]);
  return BOM + toCsvText([[...header], ...body]);
}

/** 金特実測値CSV。列順は gold_abilities.csv と同一（data_type は常に measured）。 */
export function buildGoldAbilitiesCsv(rows: GoldAbilityRow[]): string {
  const header = CSV_COLUMNS.gold_abilities;
  const body = rows.map((row) => [
    row.abilityId,
    row.displayName,
    row.playerType,
    String(row.hintLevel),
    row.senseMode,
    ...EXP_KEYS.map((key) => String(row.cost[key])),
    "measured",
  ]);
  return BOM + toCsvText([[...header], ...body]);
}

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";
export const JSON_MIME_TYPE = "application/json;charset=utf-8";

/** ブラウザのダウンロードとして出力する。外部への送信は一切行わない。 */
export function downloadText(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
