# 02. アーキテクチャ設計

---

## 1. レイヤ構成

本アプリは4層に分割する。**依存の向きは下から上への一方向のみ**とし、逆流を禁止する。

```text
┌─────────────────────────────────────────┐
│ ui/            React コンポーネント        │  ← store のみに依存
├─────────────────────────────────────────┤
│ store/         Zustand ストア             │  ← domain / data に依存
├─────────────────────────────────────────┤
│ data/          CSV読込・検証・永続化        │  ← domain（型）に依存
├─────────────────────────────────────────┤
│ domain/        計算エンジン・モデル・推定    │  ← 何にも依存しない（純粋TS）
└─────────────────────────────────────────┘
```

### 禁止事項（レビュー時の必須チェック）

| 禁止 | 理由 |
|---|---|
| `domain/` から `react` / `zustand` / `papaparse` / `idb` を import する | 計算エンジンをUI・I/Oから独立させるため |
| `domain/` 内にゲーム固有の数値リテラルを書く | すべてCSV由来とするため |
| `ui/` から `domain/calculator` を直接呼ぶ | 再計算タイミングを store に集約するため |
| `data/` から `ui/` を import する | 依存の逆流 |

`domain/` 配下は Node.js 単体（ブラウザAPIなし）で実行・テストできること。

---

## 2. データフロー

```text
public/data/<gameVersion>/*.csv
        │  fetch
        ▼
  data/csv/csvParser             … Papa Parse で行配列へ
        │
        ▼
  data/csv/validators            … 型・必須・重複・参照整合を検証
        │  ✕ → LoadError（画面へ通知しロード中止）
        ▼
  data/repositories/indexBuilder … Map インデックス構築
        │
        ▼
  store/useGameDataStore         … GameDataSet を保持
        │
        │      store/usePlanStore … PlayerPlan を保持（IndexedDB と同期）
        │              │
        └──────┬───────┘
               ▼
  domain/calculator/planCalculator
      … 純粋関数： (GameDataSet, PlayerPlan) => CalculationResult
               │
               ▼
  store/useResultStore → ui/ で表示
```

**再計算のトリガ**: `usePlanStore` または `useGameDataStore` の変更を購読し、200ms デバウンスで `planCalculator` を実行する。計算は同期処理とする（Web Worker は使用しない）。

---

## 3. 確定ディレクトリ構造

```text
pawapro-exp-calculator/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # lint / typecheck / unit / e2e
│       └── deploy.yml                      # GitHub Pages デプロイ
│
├── .claude/                                # Claude Code 用（成果物ではない）
│   └── memory/
│
├── docs/                                   # 設計・試験ドキュメント（本成果物）
│   ├── 00_index.md
│   ├── 01_requirements.md
│   ├── 02_architecture.md
│   ├── 03_data_spec.md
│   ├── 04_calculation_spec.md
│   ├── 05_ui_spec.md
│   ├── 06_persistence_spec.md
│   ├── 07_error_spec.md
│   ├── 08_nonfunctional.md
│   ├── 10_test_plan.md
│   ├── 11_unit_test_spec.md
│   ├── 12_ui_test_spec.md
│   ├── 13_e2e_test_spec.md
│   └── 14_acceptance_test.md
│
├── public/
│   └── data/
│       ├── games.json                      # ゲームバージョン定義（Git管理）
│       ├── sample2024/                     # サンプル(ダミー)CSV（Git管理）
│       │   ├── config.csv
│       │   ├── base_sense_plus.csv
│       │   ├── base_normal.csv
│       │   ├── blue_abilities.csv
│       │   ├── gold_abilities.csv
│       │   ├── gold_prerequisites.csv
│       │   ├── hint_rules.csv
│       │   ├── breaking_cache_sense_plus.csv
│       │   └── breaking_cache_normal.csv
│       └── pawapro2024/                    # 実測データ（.gitignore 対象）
│           └── （同一ファイル構成）
│
├── src/
│   ├── main.tsx                            # エントリーポイント
│   ├── App.tsx                             # タブレイアウト + 結果サマリーバー
│   │
│   ├── domain/                             # 【純粋TS層】外部依存ゼロ
│   │   ├── models/
│   │   │   ├── expVector.ts                # ExpVector 型と加算・スカラー倍
│   │   │   ├── ability.ts                  # BaseCostRow / BlueAbility / GoldAbility 等
│   │   │   ├── plan.ts                     # PlayerPlan / SpecialTarget / BreakingPlan
│   │   │   ├── gameData.ts                 # GameDataSet（インデックス集合）
│   │   │   └── result.ts                   # CalculationResult / CalculationItem
│   │   ├── calculator/
│   │   │   ├── baseCalculator.ts           # 基礎能力
│   │   │   ├── blueCalculator.ts           # 青特（binary / rank）
│   │   │   ├── goldCalculator.ts           # 金特（前提解決込み）
│   │   │   ├── breakingCalculator.ts       # 変化球（優先順位解決）
│   │   │   └── planCalculator.ts           # (1)〜(8)の統合オーケストレーション
│   │   ├── estimator/
│   │   │   └── goldEstimator.ts            # 仮想基礎値B の逆算と推定
│   │   ├── rounding.ts                     # floor / round / ceil の切替適用
│   │   └── errors/
│   │       ├── errorCodes.ts               # エラーコード定数
│   │       └── appError.ts                 # AppError / ValidationIssue
│   │
│   ├── data/                               # 【I/O層】
│   │   ├── csv/
│   │   │   ├── csvParser.ts                # Papa Parse ラッパ（BOM除去含む）
│   │   │   ├── schemas.ts                  # 各CSVのカラム定義
│   │   │   └── validators.ts               # 03章の検証ルール実装
│   │   ├── repositories/
│   │   │   ├── gameDataLoader.ts           # fetch → parse → validate → index
│   │   │   ├── indexBuilder.ts             # Map インデックス構築
│   │   │   └── keyBuilder.ts               # 一意キー生成（04章 §10）
│   │   └── persistence/
│   │       ├── db.ts                       # IndexedDB スキーマ定義（idb）
│   │       ├── planRepository.ts           # プランCRUD
│   │       ├── overrideRepository.ts       # インポートCSVの保存
│   │       ├── breakingCacheRepository.ts  # 変化球共通キャッシュ
│   │       └── exporter.ts                 # CSV / JSON 出力
│   │
│   ├── store/
│   │   ├── useGameDataStore.ts             # ゲームデータのロード状態
│   │   ├── usePlanStore.ts                 # 編集中プラン + 自動保存
│   │   ├── usePlanListStore.ts             # プラン一覧
│   │   └── useResultStore.ts               # 計算結果（派生状態）
│   │
│   ├── ui/
│   │   ├── tabs/
│   │   │   ├── PlanSettingTab.tsx          # 画面1 選手設定
│   │   │   ├── BaseAbilityTab.tsx          # 画面2 基礎能力
│   │   │   ├── SpecialAbilityTab.tsx       # 画面3 特殊能力
│   │   │   ├── BreakingBallTab.tsx         # 画面4 変化球
│   │   │   └── ResultTab.tsx               # 画面5 計算結果
│   │   ├── components/
│   │   │   ├── ResultSummaryBar.tsx        # 常時表示の合計バー
│   │   │   ├── ExpVectorTable.tsx          # 5カテゴリ表示の共通表
│   │   │   ├── SourceBadge.tsx             # 実測/推定/マスタ/手動 バッジ
│   │   │   ├── AbilityPicker.tsx           # 検索付き能力選択
│   │   │   ├── HintLevelSelect.tsx         # コツLv 0-5 選択
│   │   │   ├── IssueList.tsx               # 不足データ・エラー一覧
│   │   │   ├── PlanListDialog.tsx          # プラン一覧・複製・削除
│   │   │   └── CsvImportPanel.tsx          # CSVインポート
│   │   └── hooks/
│   │       └── useDebouncedEffect.ts
│   │
│   └── utils/
│       └── number.ts                       # 整数判定・書式化（3桁区切り）
│
├── tests/
│   ├── unit/
│   │   ├── domain/                         # 計算エンジンの単体テスト
│   │   └── data/                           # CSV検証・インデックスのテスト
│   ├── fixtures/
│   │   └── csv/                            # テスト専用CSV（正常系・異常系）
│   └── e2e/
│       └── specs/                          # Playwright シナリオ
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── .prettierrc
├── .gitignore
├── CLAUDE.md
├── Instructions.md
├── PROJECT_ARCHITECTURE.md
└── パワプロ サクセス必要経験点計算アプリ 仕様書.md   # 原仕様書（背景資料）
```

---

## 4. モジュール責務一覧

| モジュール | 責務 | 責務外 |
|---|---|---|
| `domain/models/expVector.ts` | ExpVector の生成・加算・スカラー倍・ゼロ判定 | ゲーム固有値の保持 |
| `domain/rounding.ts` | 丸めモード（floor/round/ceil）の適用 | 丸めモードの決定（CSV由来） |
| `domain/calculator/baseCalculator.ts` | 1能力分の初期値→目標値の積み上げ | CSVの読込 |
| `domain/calculator/blueCalculator.ts` | binary/rank 判定、遷移列挙、コツ・センス倍率適用 | 金特前提の解決 |
| `domain/calculator/goldCalculator.ts` | 金特の実測取得、前提青特の抽出 | 推定計算そのもの |
| `domain/estimator/goldEstimator.ts` | 仮想基礎値Bの探索と推定値算出、信頼度判定 | 変化球の推定（禁止） |
| `domain/calculator/breakingCalculator.ts` | 優先順位に従った変化球経験点の決定 | 推定・補間 |
| `domain/calculator/planCalculator.ts` | 計算順序の制御、重複排除、合計、ステータス判定 | 個別計算式 |
| `data/csv/csvParser.ts` | BOM除去、Papa Parse 実行、行→オブジェクト変換 | 業務検証 |
| `data/csv/validators.ts` | 必須カラム・型・範囲・重複・参照整合の検証 | 値の妥当性（ゲーム的正しさ） |
| `data/repositories/gameDataLoader.ts` | fetch → parse → validate → index の一連実行 | 表示 |
| `data/persistence/*` | IndexedDB の CRUD、エクスポート | 計算 |
| `store/*` | 状態保持と再計算のトリガ | 計算式の実装 |
| `ui/*` | 表示と入力受付 | 計算・検証・永続化の実装 |

---

## 5. ゲームバージョン定義ファイル

`public/data/games.json`

```json
{
  "games": [
    {
      "id": "sample2024",
      "displayName": "サンプルデータ（ダミー値）",
      "directory": "sample2024",
      "bundled": true,
      "note": "動作確認用。実際のゲームの値ではありません。"
    },
    {
      "id": "pawapro2024",
      "displayName": "パワプロ2024-2025",
      "directory": "pawapro2024",
      "bundled": false,
      "note": "実測データ。利用者が配置またはインポートしてください。"
    }
  ],
  "defaultGameId": "sample2024"
}
```

| フィールド | 型 | 内容 |
|---|---|---|
| `id` | string | ゲームバージョン識別子。英小文字・数字・アンダースコアのみ。 |
| `displayName` | string | 画面表示名。 |
| `directory` | string | `public/data/` 配下のディレクトリ名。 |
| `bundled` | boolean | `true` = リポジトリ同梱。`false` = 未配置の可能性あり。 |
| `note` | string | 画面に補足表示する説明。空文字可。 |

`bundled: false` のゲームを選択して CSV の fetch が 404 になった場合は、致命的エラーとせず
「このゲームのデータが配置されていません。CSVをインポートしてください。」と案内し、インポート画面へ誘導する。

**新作対応（完了条件19）**: `public/data/pawapro2026/` を作成しCSVを配置、`games.json` に1エントリ追加するのみで対応完了とする。`src/` 配下の変更を必要としてはならない。

---

## 6. 状態管理設計（Zustand）

| ストア | 保持する状態 | 主なアクション |
|---|---|---|
| `useGameDataStore` | `status`（idle / loading / ready / error）, `gameId`, `gameData`, `loadIssues` | `loadGame(gameId)` / `applyOverride(kind, rows)` / `clearOverride(kind)` |
| `usePlanStore` | `plan`, `dirty` | `newPlan()` / `openPlan(id)` / `updatePlan(patch)` / `save()` |
| `usePlanListStore` | `plans`（サマリー配列） | `refresh()` / `duplicate(id)` / `remove(id)` |
| `useResultStore` | `result`, `calculating` | `recalculate()`（購読により自動起動） |

**ストアに計算式を書いてはならない。** ストアは `domain/` の純粋関数を呼び出すだけとする。

---

## 7. パフォーマンス方針

| 項目 | 目標 |
|---|---|
| 初回ロード（CSV 50,000行） | 3秒以内 |
| 再計算1回 | 100ms 以内 |
| インデックス検索 | すべて O(1)（Map キー参照）。線形探索を計算経路に置かない。 |
| 仮想基礎値Bの探索 | 0〜10000 の総当たり × 5カテゴリ。金特1件あたり 10ms 以内。結果は `(gameId, abilityId, senseMode)` 単位でメモ化する。 |
