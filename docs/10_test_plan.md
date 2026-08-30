# 10. テスト計画

---

## 1. 目的

本アプリが `01_requirements.md` の機能要件と `04_calculation_spec.md` の計算仕様を満たすことを、
実装者が誰であっても同一の基準で確認できるようにする。

---

## 2. テストの4階層

| 階層 | 文書 | 実行方法 | 対象 | 目的 |
|---|---|---|---|---|
| 単体テスト | `11_unit_test_spec.md` | Vitest（自動） | `domain/` `data/` の関数 | 計算ロジックの正しさ |
| 手動UI試験 | `12_ui_test_spec.md` | 人手 | 各画面 | 表示・操作・見た目の確認 |
| E2Eテスト | `13_e2e_test_spec.md` | Playwright（自動） | 主要シナリオ | 画面〜計算〜保存の結合 |
| 受け入れ試験 | `14_acceptance_test.md` | 人手 | MVP完了条件19項目 | 発注者による検収 |

---

## 3. テストID の付与規則

| 接頭辞 | 意味 | 例 |
|---|---|---|
| `UT-` | 単体テスト | `UT-BASE-01` |
| `UI-` | 手動UI試験 | `UI-T2-05` |
| `E2E-` | E2Eテスト | `E2E-03` |
| `AT-` | 受け入れ試験 | `AT-11` |

各テスト項目は、対応する要件ID（`FR-*`）または仕様章を必ず参照する。**トレーサビリティのない試験項目を作らない。**

---

## 4. テストデータ

| 用途 | 配置 | 内容 |
|---|---|---|
| 単体テスト用 | `tests/fixtures/csv/` | 目的別の最小CSV。正常系・異常系を分けて配置する |
| E2E・手動試験用 | `public/data/sample2024/` | `03_data_spec.md` §12 の要件を満たすサンプルデータ |

### `tests/fixtures/csv/` の構成（確定）

```text
tests/fixtures/csv/
├── valid/                     # 全検証を通過する最小セット
│   ├── config.csv
│   ├── base_ability_defs.csv
│   ├── base_sense_plus.csv
│   ├── base_normal.csv
│   ├── blue_abilities.csv
│   ├── gold_abilities.csv
│   ├── gold_prerequisites.csv
│   ├── hint_rules.csv
│   ├── breaking_cache_sense_plus.csv
│   └── breaking_cache_normal.csv
├── invalid/                   # 検証エラーを1件だけ含むCSV群
│   ├── base_missing_column.csv
│   ├── base_non_integer.csv
│   ├── base_negative.csv
│   ├── base_gap_transition.csv        # to = from + 2
│   ├── base_duplicate_key.csv
│   ├── blue_rank_skip.csv             # G→E
│   ├── blue_invalid_state.csv
│   ├── blue_conflicting_type.csv      # 同一IDで binary と rank が混在
│   ├── gold_duplicate_level.csv
│   ├── gold_estimated_row.csv         # data_type = estimated
│   ├── prereq_unknown_gold.csv
│   ├── prereq_unknown_blue.csv
│   ├── hint_missing_level.csv         # gold Lv4 欠落
│   ├── empty_exp_cell.csv             # 経験点カラムが空欄
│   └── config_out_of_range.csv
└── bom/
    └── base_with_bom.csv              # UTF-8 BOM付き
```

---

## 5. 実行環境

| 項目 | 値 |
|---|---|
| Node.js | 20.x 以上 |
| 単体テスト環境 | `domain/` は `node` 環境、`ui/` は `jsdom` 環境（`vitest.config.ts` の `environmentMatchGlobs` で切替） |
| E2E ブラウザ | Chromium のみ |
| E2E 起動 | `webServer` 設定で `npm run dev` を自動起動し `http://localhost:5173` を使用 |

---

## 6. 合格基準

| 階層 | 合格基準 |
|---|---|
| 単体テスト | 全ケース PASS。`src/domain/` 行カバレッジ 90%以上、`src/data/` 80%以上 |
| 手動UI試験 | 全項目 合格。不合格が1件でもあれば修正して再実施 |
| E2Eテスト | 全シナリオ PASS |
| 受け入れ試験 | 19項目すべて 合格 |

---

## 7. 不具合の扱い

| 重要度 | 定義 | 対応 |
|---|---|---|
| A（致命） | 計算結果が誤る / データ不足を 0 として計算する / ロードできない | 即修正。リリース不可 |
| B（重大） | 特定条件で機能が使えない / 表示が明らかに誤り | 修正必須 |
| C（軽微） | 表示の崩れ・文言の揺れ | 合意のうえ次版へ回してよい |

**「データ不足を 0 として計算する」不具合は必ず重要度 A とする。** 本アプリの最重要設計原則に反するため。

---

## 8. テスト実行結果の報告形式

本プロジェクトでは `pytest` ではなく Vitest を使用するが、`CLAUDE.md` に定めるレポート形式に準じて報告する。

```text
## テスト結果サマリー
- 実行対象: <ファイル名 or 全テスト>
- 合計: X passed / Y failed / Z skipped （所要時間: N秒）
- カバレッジ: src/domain XX% / src/data XX%
- 判定: 全パス / 失敗あり
```

続けて、テストファイル・describe 単位の一覧表（テスト名 / 何を検証するか / 結果）を出す。
失敗がある場合は、**原因分析までを報告して一旦停止**し、修正方針の承認を得てから修正する。
