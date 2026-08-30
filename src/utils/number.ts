/**
 * 数値の表示・入力整形（05_ui_spec.md §1・§9）。
 * ゲーム固有の値は持たず、書式と型変換のみを担う。
 */

/** 3桁カンマ区切り。0 は "0" と表示する。 */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * 入力文字列を整数として解釈する。整数として読めない場合は null。
 * 空文字は「未入力」を意味するため null を返し、0 とは区別する。
 */
export function parseIntegerInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(value) ? value : null;
}

/** value を [min, max] に収める。min > max の場合は min を返す。 */
export function clampInt(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
