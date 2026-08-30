/**
 * 数値の書式化・整数判定（05_ui_spec.md §1・§9）。
 */
import { describe, expect, it } from "vitest";
import { clampInt, formatNumber, parseIntegerInput } from "@/utils/number";

describe("formatNumber", () => {
  it("3桁カンマ区切りで表示し、0 は 0 と表示する", () => {
    expect(formatNumber(1820)).toBe("1,820");
    expect(formatNumber(430)).toBe("430");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("parseIntegerInput", () => {
  it("整数として読める文字列のみ数値にする", () => {
    expect(parseIntegerInput("130")).toBe(130);
    expect(parseIntegerInput(" 42 ")).toBe(42);
    expect(parseIntegerInput("-3")).toBe(-3);
  });

  it("空欄・非整数は null（0 と区別する）", () => {
    expect(parseIntegerInput("")).toBeNull();
    expect(parseIntegerInput("   ")).toBeNull();
    expect(parseIntegerInput("1.5")).toBeNull();
    expect(parseIntegerInput("abc")).toBeNull();
    expect(parseIntegerInput("0")).toBe(0);
  });
});

describe("clampInt", () => {
  it("範囲内へ収める", () => {
    expect(clampInt(150, 100, 170)).toBe(150);
    expect(clampInt(99, 100, 170)).toBe(100);
    expect(clampInt(200, 100, 170)).toBe(170);
  });
});
