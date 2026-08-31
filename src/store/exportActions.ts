/**
 * エクスポート操作（06_persistence_spec.md §4）。
 * 整形は data 層の純粋関数に委ね、ここでは現在のストア状態を渡してダウンロードを起動する。
 * ui 層から data 層を直接呼ばないための中継（02_architecture.md §1）。
 */
import {
  buildExportFileName,
  buildPlanJson,
  buildResultCsv,
  buildResultJson,
  CSV_MIME_TYPE,
  downloadText,
  JSON_MIME_TYPE,
} from "@/data/persistence/exporter";
import { usePlanStore } from "./usePlanStore";
import { useResultStore } from "./useResultStore";

function currentLabel(): string | null {
  return usePlanStore.getState().plan?.name ?? null;
}

/** 計算結果CSV（UTF-8 BOM付き）。結果が無い場合は何もしない。 */
export function exportResultCsv(now: Date = new Date()): boolean {
  const result = useResultStore.getState().result;
  const label = currentLabel();
  if (result === null || label === null) return false;
  downloadText(
    buildExportFileName("result", label, "csv", now),
    buildResultCsv(result),
    CSV_MIME_TYPE,
  );
  return true;
}

export function exportResultJson(now: Date = new Date()): boolean {
  const result = useResultStore.getState().result;
  const label = currentLabel();
  if (result === null || label === null) return false;
  downloadText(
    buildExportFileName("result", label, "json", now),
    buildResultJson(result),
    JSON_MIME_TYPE,
  );
  return true;
}

export function exportPlanJson(now: Date = new Date()): boolean {
  const plan = usePlanStore.getState().plan;
  if (plan === null) return false;
  downloadText(
    buildExportFileName("plan", plan.name, "json", now),
    buildPlanJson(plan, now),
    JSON_MIME_TYPE,
  );
  return true;
}
