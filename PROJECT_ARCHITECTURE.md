# Project Architecture

## プロジェクト概要

パワプロ（eBASEBALLパワフルプロ野球）のサクセスモードで育成する選手について、初期基礎能力・初期特殊能力・取得済み／取得予定のコツ・目標基礎能力・目標特殊能力・目標変化球を入力すると、完成までに必要な経験点（筋力・敏捷・技術・変化球・精神）を計算するアプリ。初期対応タイトルは eBASEBALLパワフルプロ野球2024-2025（パワフルフューチャーズ）。ゲーム固有の数値データはプログラムコードに直接書かず、CSVとして分離管理し、新作発売時は原則CSVの差し替えのみで対応できる設計とする。

## 設計ドキュメント（正）

**実装の確定仕様は `docs/` 配下にある。** 本ファイルは概要とエントリーポイントのみを扱う。

| 文書 | 内容 |
|---|---|
| [docs/00_index.md](docs/00_index.md) | 索引・用語集・確定事項サマリー |
| [docs/01_requirements.md](docs/01_requirements.md) | 要件定義（機能要件ID・対象外・完了条件） |
| [docs/02_architecture.md](docs/02_architecture.md) | アーキテクチャ・ディレクトリ構造・モジュール責務 |
| [docs/03_data_spec.md](docs/03_data_spec.md) | CSVデータ仕様・検証ルール |
| [docs/04_calculation_spec.md](docs/04_calculation_spec.md) | 計算エンジン仕様（型・アルゴリズム・境界条件） |
| [docs/05_ui_spec.md](docs/05_ui_spec.md) | 画面仕様 |
| [docs/06_persistence_spec.md](docs/06_persistence_spec.md) | 保存・インポート・エクスポート仕様 |
| [docs/07_error_spec.md](docs/07_error_spec.md) | エラーコード・バリデーション・文言 |
| [docs/08_nonfunctional.md](docs/08_nonfunctional.md) | 非機能要件・ビルド・デプロイ・コーディング規約 |
| [docs/09_milestones.md](docs/09_milestones.md) | 完成までのマイルストーン（工程・完了判定・リスク） |
| [docs/10_test_plan.md](docs/10_test_plan.md) | テスト計画 |
| [docs/11_unit_test_spec.md](docs/11_unit_test_spec.md) | 単体テスト仕様（Vitest） |
| [docs/12_ui_test_spec.md](docs/12_ui_test_spec.md) | 手動UI試験項目表 |
| [docs/13_e2e_test_spec.md](docs/13_e2e_test_spec.md) | E2Eテスト仕様（Playwright） |
| [docs/14_acceptance_test.md](docs/14_acceptance_test.md) | 受け入れ試験（検収チェックリスト） |

原仕様書 `パワプロ サクセス必要経験点計算アプリ 仕様書.md`（v1.0）は背景資料。**矛盾する場合は `docs/` を優先する。**

## 技術スタック（確定）

TypeScript 5 / React 18 / Vite 5 / Zustand 4 / Papa Parse 5 / idb 8 / Vitest 2 / Playwright 1.47 / ESLint + Prettier。
すべて MIT・Apache-2.0 等のOSS。サーバーサイドなし。GitHub Pages へ静的デプロイ。

## ディレクトリ構造

```
pawapro-exp-calculator/
├── .github/workflows/      # ci.yml（lint/型/単体/E2E）, deploy.yml（Pages）
├── .claude/memory/         # Claude のプロジェクトメモリ
├── docs/                   # 設計・試験ドキュメント（確定仕様）
├── public/data/            # ゲームデータCSV
│   ├── games.json          #   ゲームバージョン定義
│   ├── sample2024/         #   サンプル（ダミー値）CSV：Git管理
│   └── pawapro2024/        #   実測データ：.gitignore 対象
├── src/
│   ├── domain/             # 【純粋TS層】計算エンジン・モデル・推定・エラー
│   │   ├── models/  calculator/  estimator/  errors/  rounding.ts
│   ├── data/               # 【I/O層】CSV読込・検証・インデックス・IndexedDB
│   │   ├── csv/  repositories/  persistence/
│   ├── store/              # Zustand ストア
│   ├── ui/                 # React コンポーネント
│   │   ├── tabs/  components/  hooks/
│   └── utils/
├── tests/
│   ├── unit/{domain,data}/ # Vitest
│   ├── fixtures/csv/       # テスト用CSV（valid / invalid / bom）
│   └── e2e/specs/          # Playwright
├── index.html / package.json / tsconfig.json
├── vite.config.ts / vitest.config.ts / playwright.config.ts
├── eslint.config.js / .prettierrc / .gitignore
└── CLAUDE.md / Instructions.md / PROJECT_ARCHITECTURE.md
```

詳細は [docs/02_architecture.md](docs/02_architecture.md) §3。

## アーキテクチャ

依存の向きは **`domain` ← `data` ← `store` ← `ui`** の一方向のみ。逆流は Lint で禁止する。

```
public/data/<gameVersion>/*.csv
    ↓ fetch
data/csv/csvParser → data/csv/validators → data/repositories/indexBuilder
    ↓
store/useGameDataStore（GameDataSet）＋ store/usePlanStore（PlayerPlan）
    ↓
domain/calculator/planCalculator（純粋関数）
    ↓
store/useResultStore → ui/
```

`src/domain/` は React・Zustand・Papa Parse・idb を import しない。ブラウザAPIなしで単体実行できること。

## データモデル

主要な型は [docs/04_calculation_spec.md](docs/04_calculation_spec.md) §1 に確定定義がある。
`ExpVector` / `PlayerPlan` / `GameDataSet` / `CalculationResult` / `CalculationItem` / `CalculationIssue`。

## 入出力・外部インターフェース

- API: なし（100%クライアント完結。**外部通信を一切行わない**）
- 入力: CSV（UTF-8、BOM可、カンマ区切り）、プランJSON
- 出力: 計算結果CSV（BOM付き）/ JSON、プランJSON、実測値CSV
- 永続化: IndexedDB（DB名 `pawapro-exp-calculator`、v1）

## エントリーポイント

- 実行開始ファイル: `src/main.tsx`
- 起動コマンド: `npm run dev`
- 検証コマンド: `npm run verify`（lint → typecheck → 単体+カバレッジ → E2E）

## 既知の問題・TODO

- [x] 技術スタックの最終確定
- [x] ディレクトリ構造の最終確定
- [x] 設計仕様書の作成（docs/00〜08）
- [x] 試験項目の作成（docs/10〜14）
- [x] サンプルCSVデータの作成（`public/data/sample2024/`）
- [x] Vite プロジェクトの初期化（package.json / tsconfig / vite.config 等）
- [x] `src/domain/` の実装と単体テスト（M1〜M4・行カバレッジ98.8%）
- [x] `src/data/` の実装と単体テスト（M5〜M7・行カバレッジ82.0%）
- [x] `src/store/` の実装と単体テスト（M8）
- [x] `src/ui/` の実装（M9〜M11・タブ5画面 + 結果サマリーバー + プラン一覧）
- [x] E2Eテストの実装（M12・E2E-01〜11）
- [x] CI / GitHub Pages デプロイの設定（M12・`.github/workflows/`）※Pages のソース設定はリポジトリ側の作業
- [ ] 実測データCSV（パワプロ2024-2025分）の作成 ※利用者作業
