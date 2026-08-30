import type { RoundingMode } from "./models/ability";

/**
 * 浮動小数点の丸め誤差で 1 ずれるのを防ぐため、丸める直前に有効桁を落として正規化する。
 * 240 * 0.7 は 168.00000000000003 になるため、正規化しないと floor で 167 になってしまう。
 */
export function normalize(value: number): number {
  return Number(value.toFixed(6));
}

export function applyRounding(value: number, mode: RoundingMode): number {
  const v = normalize(value);
  switch (mode) {
    case "floor":
      return Math.floor(v);
    case "ceil":
      return Math.ceil(v);
    case "round":
      return Math.floor(v + 0.5);
  }
}
