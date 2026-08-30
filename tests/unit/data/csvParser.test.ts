import { describe, expect, it } from "vitest";
import { parseCsv, stripBom, toCamelCase } from "@/data/csv/csvParser";
import { readFixture } from "../../fixtures/csvFixtures";

const BOM_FIXTURE = readFixture("bom", "base_sense_plus_bom.csv");

describe("parseCsv", () => {
  it("UT-CSV-01: BOM が除去され1列目のヘッダ名が解決される", () => {
    const parsed = parseCsv(BOM_FIXTURE);
    expect(parsed.headers[0]).toBe("abilityId");
    expect(parsed.rows[0]?.values.abilityId).toBe("velocity");
  });

  it("UT-CSV-02: CRLF 改行を正常にパースする", () => {
    expect(BOM_FIXTURE).toContain("\r\n");
    expect(parseCsv(BOM_FIXTURE).rows).toHaveLength(2);
  });

  it("UT-CSV-03: 空行を無視する", () => {
    const parsed = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(parsed.rows.map((row) => row.values.a)).toEqual(["1", "3"]);
  });

  it("UT-CSV-04: # で始まる行を無視する", () => {
    const parsed = parseCsv("a,b\n# コメント\n1,2\n");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.values.b).toBe("2");
  });

  it("UT-CSV-05: セル前後の空白をトリムする", () => {
    const parsed = parseCsv(BOM_FIXTURE);
    expect(parsed.rows[0]?.values.playerType).toBe("pitcher");
    expect(parsed.rows[0]?.values.muscle).toBe("10");
  });

  it("UT-CSV-06: 未知のカラムは無視され、エラーにならない", () => {
    const parsed = parseCsv(BOM_FIXTURE);
    expect(parsed.headers).toContain("memo");
    expect(parsed.rows[0]?.values.fromValue).toBe("130");
  });

  it("UT-CSV-07: カラム順が仕様と異なってもヘッダ名で解決される", () => {
    const parsed = parseCsv(BOM_FIXTURE);
    // フィクスチャは to_value が from_value より前に並んでいる
    expect(parsed.headers.indexOf("toValue")).toBeLessThan(parsed.headers.indexOf("fromValue"));
    expect(parsed.rows[0]?.values.toValue).toBe("131");
    expect(parsed.rows[0]?.values.fromValue).toBe("130");
  });

  it("UT-CSV-08: ダブルクォート内のカンマを1セルとして解釈する", () => {
    const parsed = parseCsv(BOM_FIXTURE);
    expect(parsed.rows[0]?.values.memo).toBe("備考, あり");
  });

  it("UT-CSV-09: snake_case のヘッダを camelCase へ変換する", () => {
    expect(toCamelCase("from_value")).toBe("fromValue");
    expect(toCamelCase("total_break_before")).toBe("totalBreakBefore");
    expect(toCamelCase("key")).toBe("key");
  });

  it("行番号はヘッダを1行目として数える", () => {
    const parsed = parseCsv("a,b\n1,2\n3,4\n");
    expect(parsed.rows.map((row) => row.line)).toEqual([2, 3]);
  });

  it("BOM が無い入力はそのまま扱う", () => {
    expect(stripBom("a,b")).toBe("a,b");
  });
});
