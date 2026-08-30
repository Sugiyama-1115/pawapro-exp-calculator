import { describe, expect, it } from "vitest";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES, INCOMPLETE_CODES } from "@/domain/errors/errorCodes";

describe("AppError", () => {
  it("code / message / detail を保持する", () => {
    const error = new AppError(ERROR_CODES.STORAGE_ERROR, "保存に失敗しました。", { key: "plan" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe("STORAGE_ERROR");
    expect(error.message).toBe("保存に失敗しました。");
    expect(error.detail).toEqual({ key: "plan" });
  });

  it("detail は省略できる", () => {
    const error = new AppError(ERROR_CODES.CSV_FILE_MISSING, "見つかりません。");
    expect(error.detail).toBeUndefined();
  });
});

describe("INCOMPLETE_CODES", () => {
  it("計算系のデータ不足コードを含む", () => {
    expect(INCOMPLETE_CODES.has(ERROR_CODES.BASE_DATA_MISSING)).toBe(true);
    expect(INCOMPLETE_CODES.has(ERROR_CODES.INVALID_TARGET)).toBe(true);
    expect(INCOMPLETE_CODES.has(ERROR_CODES.INVALID_CSV)).toBe(false);
  });
});
