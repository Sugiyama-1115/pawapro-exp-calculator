import { describe, expect, it } from "vitest";
import {
  addVector,
  isZeroVector,
  sumVectors,
  totalOf,
  zeroVector,
} from "@/domain/models/expVector";
import { v } from "../../fixtures/sampleGameData";

describe("ExpVector", () => {
  it("UT-VEC-01: zeroVector は全項目0", () => {
    expect(zeroVector()).toEqual(v(0, 0, 0, 0, 0));
  });

  it("UT-VEC-02: addVector は各項目を加算する", () => {
    expect(addVector(v(1, 2, 3, 4, 5), v(10, 20, 30, 40, 50))).toEqual(v(11, 22, 33, 44, 55));
  });

  it("UT-VEC-03: addVector は引数を破壊しない", () => {
    const a = v(1, 2, 3, 4, 5);
    const b = v(10, 20, 30, 40, 50);
    const result = addVector(a, b);
    expect(a).toEqual(v(1, 2, 3, 4, 5));
    expect(b).toEqual(v(10, 20, 30, 40, 50));
    expect(result).not.toBe(a);
  });

  it("UT-VEC-04: sumVectors は空配列でゼロ", () => {
    expect(sumVectors([])).toEqual(v(0, 0, 0, 0, 0));
  });

  it("UT-VEC-05: totalOf は5項目の合計", () => {
    expect(totalOf(v(1, 2, 3, 4, 5))).toBe(15);
  });

  it("isZeroVector はゼロ判定を行う", () => {
    expect(isZeroVector(zeroVector())).toBe(true);
    expect(isZeroVector(v(0, 0, 1, 0, 0))).toBe(false);
  });

  it("sumVectors は複数ベクトルを加算する", () => {
    expect(sumVectors([v(1, 1, 1, 1, 1), v(2, 2, 2, 2, 2)])).toEqual(v(3, 3, 3, 3, 3));
  });
});
