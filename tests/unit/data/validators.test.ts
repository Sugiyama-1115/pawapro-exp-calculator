import { describe, expect, it } from "vitest";
import { parseCsv } from "@/data/csv/csvParser";
import type { CsvKind } from "@/data/csv/schemas";
import { MAX_ISSUES, validateDataSet, validateFile } from "@/data/csv/validators";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import { parseValidFixtures, readFixture } from "../../fixtures/csvFixtures";

function issuesOf(kind: CsvKind, fileName: string) {
  const parsed = parseCsv(readFixture("invalid", fileName));
  return validateFile(kind, parsed, fileName).issues;
}

function codesOf(kind: CsvKind, fileName: string): string[] {
  return issuesOf(kind, fileName).map((issue) => issue.code);
}

const FILE_CASES: Array<[string, CsvKind, string, string, string]> = [
  ["UT-VAL-01", "base_sense_plus", "base_missing_column.csv", ERROR_CODES.INVALID_CSV, "V-02"],
  ["UT-VAL-02", "base_sense_plus", "base_non_integer.csv", ERROR_CODES.INVALID_CSV, "V-03"],
  ["UT-VAL-03", "base_sense_plus", "base_negative.csv", ERROR_CODES.INVALID_CSV, "V-04"],
  ["UT-VAL-04", "base_sense_plus", "empty_exp_cell.csv", ERROR_CODES.INVALID_CSV, "V-05"],
  ["UT-VAL-05", "base_sense_plus", "base_gap_transition.csv", ERROR_CODES.INVALID_CSV, "V-13"],
  ["UT-VAL-06", "base_sense_plus", "base_duplicate_key.csv", ERROR_CODES.DUPLICATE_DATA, "V-16"],
  ["UT-VAL-07", "blue_abilities", "blue_rank_skip.csv", ERROR_CODES.INVALID_CSV, "V-15"],
  ["UT-VAL-08", "blue_abilities", "blue_invalid_state.csv", ERROR_CODES.INVALID_CSV, "V-11"],
  ["UT-VAL-09", "blue_abilities", "blue_conflicting_type.csv", ERROR_CODES.INVALID_CSV, "V-17"],
  ["UT-VAL-09a", "blue_abilities", "blue_missing_baseline.csv", ERROR_CODES.INVALID_CSV, "V-27"],
  ["UT-VAL-09b", "blue_abilities", "blue_duplicate_hint.csv", ERROR_CODES.DUPLICATE_DATA, "V-16"],
  ["UT-VAL-09c", "blue_abilities", "blue_invalid_hint_level.csv", ERROR_CODES.INVALID_CSV, "V-09"],
  ["UT-VAL-09d", "blue_abilities", "blue_invalid_sense_mode.csv", ERROR_CODES.INVALID_CSV, "V-08"],
  ["UT-VAL-10", "gold_abilities", "gold_duplicate_level.csv", ERROR_CODES.DUPLICATE_DATA, "V-16"],
  ["UT-VAL-11", "gold_abilities", "gold_estimated_row.csv", ERROR_CODES.INVALID_CSV, "V-24"],
  ["UT-VAL-14", "hint_rules", "hint_missing_level.csv", ERROR_CODES.INVALID_CSV, "V-23"],
  ["UT-VAL-15", "config", "config_out_of_range.csv", ERROR_CODES.INVALID_CSV, "V-25"],
];

describe("validateFile", () => {
  for (const [id, kind, fileName, expectedCode, rule] of FILE_CASES) {
    it(`${id}: ${fileName} は ${expectedCode} を返す（${rule}）`, () => {
      expect(codesOf(kind, fileName)).toContain(expectedCode);
    });
  }

  it("UT-VAL-17: 複数エラーを最初の1件で打ち切らず全件報告する", () => {
    const issues = issuesOf("base_sense_plus", "multi_error.csv");
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.map((issue) => issue.line)).toEqual([2, 3, 4]);
  });

  it("UT-VAL-19: エラーに file / line / column が含まれる", () => {
    const issue = issuesOf("base_sense_plus", "base_non_integer.csv")[0];
    expect(issue?.file).toBe("base_non_integer.csv");
    // ヘッダを1行目として数えるため、2行目のデータ行が 2 になる
    expect(issue?.line).toBe(2);
    expect(issue?.column).toBe("technique");
    expect(issue?.message).toContain("0 以上の整数ではありません");
  });
});

describe("validateDataSet", () => {
  it("UT-VAL-16: 標準フィクスチャ一式はエラー0件", () => {
    const result = validateDataSet(parseValidFixtures(), { directory: "sample2024" });
    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
    expect(result.data?.blue_abilities).toHaveLength(12);
  });

  it("UT-VAL-12: gold_prerequisites.gold_id の未登録参照を検出する（V-18）", () => {
    const files = parseValidFixtures();
    files.gold_prerequisites = parseCsv(readFixture("invalid", "prereq_unknown_gold.csv"));
    const result = validateDataSet(files);
    expect(result.data).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain(ERROR_CODES.INVALID_CSV);
    expect(result.issues.some((issue) => issue.column === "gold_id")).toBe(true);
  });

  it("UT-VAL-13: gold_prerequisites.lower_blue_id の未登録参照を検出する（V-19）", () => {
    const files = parseValidFixtures();
    files.gold_prerequisites = parseCsv(readFixture("invalid", "prereq_unknown_blue.csv"));
    const result = validateDataSet(files);
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.column === "lower_blue_id")).toBe(true);
  });

  it("V-21: base_*.csv の未登録 ability_id を検出する", () => {
    const files = parseValidFixtures();
    files.base_normal = parseCsv(
      [
        "player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental",
        "pitcher,unknown_ability,10,11,1,0,1,0,1",
      ].join("\n"),
    );
    const result = validateDataSet(files);
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("unknown_ability"))).toBe(true);
  });

  it("V-22: base_ability_defs の範囲外の値を検出する", () => {
    const files = parseValidFixtures();
    files.base_normal = parseCsv(
      [
        "player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental",
        "fielder,trajectory,8,9,1,0,1,0,1",
      ].join("\n"),
    );
    const result = validateDataSet(files);
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("範囲"))).toBe(true);
  });

  it("V-01: 必須ファイルが欠けると CSV_FILE_MISSING を返す", () => {
    const files = parseValidFixtures();
    delete (files as Partial<typeof files>).hint_rules;
    const result = validateDataSet(files, { directory: "sample2024" });
    const missing = result.issues.find((issue) => issue.code === ERROR_CODES.CSV_FILE_MISSING);
    expect(missing?.file).toBe("hint_rules.csv");
    expect(missing?.message).toContain("public/data/sample2024/");
  });

  it("V-01: base_sense_plus / base_normal は少なくとも一方あればよい", () => {
    const files = parseValidFixtures();
    delete (files as Partial<typeof files>).base_normal;
    expect(validateDataSet(files).issues).toEqual([]);
  });

  it("任意ファイル（変化球キャッシュ）が無くてもエラーにならない", () => {
    const files = parseValidFixtures();
    delete (files as Partial<typeof files>).breaking_cache_normal;
    delete (files as Partial<typeof files>).breaking_cache_sense_plus;
    const result = validateDataSet(files);
    expect(result.issues).toEqual([]);
    expect(result.data?.breaking_cache_normal).toEqual([]);
  });

  it("UT-VAL-18: 201件以上のエラーは200件まで返し、超過件数を示す", () => {
    const rows = ["player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental"];
    for (let i = 0; i < 250; i++) {
      rows.push(`pitcher,velocity,${130 + i},${131 + i},abc,0,5,0,0`);
    }
    const files = parseValidFixtures();
    files.base_sense_plus = parseCsv(rows.join("\n"));
    const result = validateDataSet(files);
    expect(result.issues).toHaveLength(MAX_ISSUES);
    expect(result.omittedCount).toBeGreaterThan(0);
    expect(result.data).toBeNull();
  });

  it("上書き（overrides）は種別単位で標準データを全置換する", () => {
    const files = parseValidFixtures();
    const result = validateDataSet(files, {
      overrides: {
        gold_prerequisites: [
          { goldId: "archartist", lowerBlueId: "power_hitter", requiredState: "ON", line: 2 },
        ],
      },
    });
    expect(result.issues).toEqual([]);
    expect(result.data?.gold_prerequisites).toHaveLength(1);
  });
});
