import { describe, expect, it } from "vitest";
import { applyRounding, normalize } from "@/domain/rounding";

describe("applyRounding", () => {
  it("UT-RND-01: floor は切り捨て", () => {
    expect(applyRounding(3.9, "floor")).toBe(3);
  });

  it("UT-RND-02: ceil は切り上げ", () => {
    expect(applyRounding(3.1, "ceil")).toBe(4);
  });

  it("UT-RND-03: round は 0.5 を切り上げ", () => {
    expect(applyRounding(3.5, "round")).toBe(4);
  });

  it("UT-RND-04: 浮動小数点誤差を正規化する（167 にならない）", () => {
    // 仕様が例示する 240 × 0.7 の誤差付き値。正規化しないと floor で 167 になる
    expect(applyRounding(168.00000000000003, "floor")).toBe(168);
    expect(applyRounding(240 * 0.7, "floor")).toBe(168);
    // 誤差で 1 下振れするケース（正規化なしなら 2 になる）
    expect(applyRounding(2.9999999999999996, "floor")).toBe(3);
  });

  it("UT-RND-05: 誤差正規化が過剰でない", () => {
    expect(applyRounding(2.9999, "floor")).toBe(2);
  });

  it("normalize は小数第6位までに丸める", () => {
    expect(normalize(168.00000000000003)).toBe(168);
    expect(normalize(2.9999)).toBe(2.9999);
  });
});
