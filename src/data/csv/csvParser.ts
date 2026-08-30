import Papa from "papaparse";

/**
 * CSV 1行分。`line` はファイル先頭を1行目とする物理行番号
 * （03_data_spec.md §11「行番号はヘッダを1行目として数える」）。
 */
export interface CsvRow {
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  /** ヘッダ名を camelCase へ変換したもの。列順は元CSVのまま。 */
  headers: string[];
  rows: CsvRow[];
}

/** UTF-8 BOM を除去する。BOM 無しの入力はそのまま返す。 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** `from_value` → `fromValue`。CSV のヘッダ名解決に用いる。 */
export function toCamelCase(name: string): string {
  return name.replace(/_+([a-z0-9])/g, (_match: string, c: string) => c.toUpperCase());
}

/**
 * CSV を行オブジェクトの配列へ変換する（03_data_spec.md §1）。
 * BOM 除去・空行/コメント行の無視・セルのトリム・ヘッダ名での列解決までを担い、
 * 業務的な検証は一切行わない（validators の責務）。
 */
export function parseCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<string[]>(stripBom(text), {
    header: false,
    delimiter: ",",
    skipEmptyLines: false,
  });

  let headers: string[] | null = null;
  const rows: CsvRow[] = [];

  const table = parsed.data;
  for (let i = 0; i < table.length; i++) {
    const rawCells = table[i];
    if (!rawCells) continue;
    const cells = rawCells.map((cell) => (typeof cell === "string" ? cell.trim() : ""));
    if (isIgnorableLine(cells)) continue;

    if (headers === null) {
      headers = cells.map(toCamelCase);
      continue;
    }

    const values: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header === undefined || header === "") continue;
      values[header] = cells[c] ?? "";
    }
    rows.push({ line: i + 1, values });
  }

  return { headers: headers ?? [], rows };
}

function isIgnorableLine(cells: string[]): boolean {
  if ((cells[0] ?? "").startsWith("#")) return true;
  return cells.every((cell) => cell === "");
}
