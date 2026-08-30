/**
 * tests/fixtures/csv/ 配下のCSVを読み出すヘルパ。
 * 11_unit_test_spec.md §1 の標準フィクスチャは public/data/sample2024/ と同一内容である。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, type ParsedCsv } from "@/data/csv/csvParser";
import type { CsvKind } from "@/data/csv/schemas";
import { CSV_FILE_NAMES, CSV_KINDS } from "@/data/csv/schemas";

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "csv");

export function readFixture(category: "valid" | "invalid" | "bom", fileName: string): string {
  return readFileSync(join(FIXTURE_ROOT, category, fileName), "utf8");
}

export function readValidCsv(kind: CsvKind): string {
  return readFixture("valid", CSV_FILE_NAMES[kind]);
}

/** 標準フィクスチャ一式をパースして返す。 */
export function parseValidFixtures(): Record<CsvKind, ParsedCsv> {
  const files = {} as Record<CsvKind, ParsedCsv>;
  for (const kind of CSV_KINDS) {
    files[kind] = parseCsv(readValidCsv(kind));
  }
  return files;
}

/** 標準フィクスチャの生テキスト一式。 */
export function readValidTexts(): Record<CsvKind, string> {
  const texts = {} as Record<CsvKind, string>;
  for (const kind of CSV_KINDS) {
    texts[kind] = readValidCsv(kind);
  }
  return texts;
}
