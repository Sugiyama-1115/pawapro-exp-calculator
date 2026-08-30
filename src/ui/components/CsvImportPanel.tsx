/**
 * CSVインポートパネル（05_ui_spec.md §3.3 / 06_persistence_spec.md §5.1）。
 * 検証は store 経由で data 層が行う。1件でも違反があれば適用しない。
 */
import { useState, type ChangeEvent } from "react";
import type { CsvKind, ValidationIssue } from "@/store/useGameDataStore";
import { useGameDataStore } from "@/store/useGameDataStore";
import { IssuePanel } from "./IssuePanel";

/** ファイルサイズ上限 20MB（06_persistence_spec.md §5.1）。 */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const INVALID_FILE_MESSAGE = "CSVファイル（20MB以下）を選択してください。";

/** 表示順は 05_ui_spec.md §3.3 の一覧に合わせる。 */
const IMPORT_ROWS: { kind: CsvKind; label: string }[] = [
  { kind: "base_sense_plus", label: "基礎能力（センス○）" },
  { kind: "base_normal", label: "基礎能力（通常）" },
  { kind: "blue_abilities", label: "青特殊能力" },
  { kind: "gold_abilities", label: "金特殊能力" },
  { kind: "gold_prerequisites", label: "金特前提" },
  { kind: "hint_rules", label: "コツ倍率" },
  { kind: "base_ability_defs", label: "基礎能力定義" },
  { kind: "config", label: "設定(config)" },
  { kind: "breaking_cache_sense_plus", label: "変化球キャッシュ(センス○)" },
  { kind: "breaking_cache_normal", label: "変化球キャッシュ(通常)" },
];

interface RejectionState {
  kind: CsvKind;
  message: string;
  issues: ValidationIssue[];
}

export function CsvImportPanel(): JSX.Element {
  const overrides = useGameDataStore((state) => state.overrides);
  const importCsv = useGameDataStore((state) => state.importCsv);
  const clearOverride = useGameDataStore((state) => state.clearOverride);
  const [rejection, setRejection] = useState<RejectionState | null>(null);
  const [busyKind, setBusyKind] = useState<CsvKind | null>(null);

  async function handleChange(kind: CsvKind, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // 同じファイルを続けて選び直せるように入力値は毎回クリアする
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") || file.size > MAX_IMPORT_BYTES) {
      setRejection({ kind, message: INVALID_FILE_MESSAGE, issues: [] });
      return;
    }

    setBusyKind(kind);
    const text = await file.text();
    const outcome = await importCsv(kind, file.name, text);
    setBusyKind(null);
    setRejection(outcome.ok ? null : { kind, message: outcome.message, issues: outcome.issues });
  }

  return (
    <details className="csv-import-panel">
      <summary>CSVインポート（標準データを上書き）</summary>
      <table className="csv-import-table">
        <thead>
          <tr>
            <th scope="col">種別</th>
            <th scope="col">ファイル</th>
            <th scope="col">状態</th>
          </tr>
        </thead>
        <tbody>
          {IMPORT_ROWS.map(({ kind, label }) => {
            const override = overrides.find((record) => record.kind === kind);
            const inputId = `csv-import-input-${kind}`;
            return (
              <tr key={kind}>
                <th scope="row">
                  <label htmlFor={inputId}>{label}</label>
                </th>
                <td>
                  <input
                    id={inputId}
                    type="file"
                    accept=".csv,text/csv"
                    data-testid={`csv-import-${kind}`}
                    disabled={busyKind !== null}
                    onChange={(event) => {
                      void handleChange(kind, event);
                    }}
                  />
                </td>
                <td>
                  {override ? (
                    <>
                      <span>インポート済 {override.rowCount}行</span>
                      <button
                        type="button"
                        data-testid={`csv-discard-${kind}`}
                        onClick={() => {
                          void clearOverride(kind);
                        }}
                      >
                        破棄
                      </button>
                    </>
                  ) : (
                    <span>標準</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rejection && (
        <IssuePanel
          testId="csv-import-error-panel"
          title={rejection.message}
          issues={rejection.issues}
        />
      )}
    </details>
  );
}
