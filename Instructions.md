# Instructions

## プロジェクト概要

パワプロ（eBASEBALLパワフルプロ野球）のサクセスモードで育成する選手について、初期基礎能力・初期特殊能力・取得済み／取得予定のコツ・目標基礎能力・目標特殊能力・目標変化球を入力すると、完成までに必要な経験点（筋力・敏捷・技術・変化球・精神）を計算するアプリ。初期対応タイトルは eBASEBALLパワフルプロ野球2024-2025（パワフルフューチャーズ）。

## 目的・背景

サクセス開始前に「この選手を完成させるには各経験点が何点必要か」を把握し、育成計画を立てられるようにする。
ゲーム固有の数値はCSVに分離し、新作が出てもCSVの差し替えだけで長期間使い続けられることを設計目標とする。

## 設計ドキュメント

**実装の確定仕様は `docs/` 配下。** 索引は [docs/00_index.md](docs/00_index.md)。
原仕様書（`パワプロ サクセス必要経験点計算アプリ 仕様書.md`）は背景資料であり、矛盾時は `docs/` を優先する。

## 主要な技術スタック

- 言語: TypeScript 5（`strict: true`）
- UI: React 18 / ビルド: Vite 5 / 状態管理: Zustand 4
- CSV: Papa Parse 5 / 永続化: IndexedDB（idb 8）
- テスト: Vitest 2（単体）/ Playwright 1.47（E2E）
- Lint: ESLint + Prettier
- サーバー・DBサーバーなし。GitHub Pages へ静的デプロイ
- 依存ライセンスは MIT / Apache-2.0 / BSD / ISC のみ（GPL系不可）

## 開発環境のセットアップ手順

```bash
# 初回のみ: Vite プロジェクトを現ディレクトリに初期化
npm create vite@latest . -- --template react-ts

# 依存の導入
npm install
npm install zustand papaparse idb
npm install -D @types/papaparse vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @playwright/test \
  eslint typescript-eslint eslint-plugin-react-hooks prettier
npx playwright install chromium

# 開発サーバー
npm run dev

# 検証（コミット前に必須）
npm run verify
```

## 実装の進め方（推奨順）

1. `src/domain/` を先に完成させる（外部依存ゼロ・純粋関数）→ `tests/unit/domain/` で固める
2. `src/data/`（CSV読込・検証・インデックス）→ `tests/unit/data/`
3. `src/store/`
4. `src/ui/`（タブ5画面 + 結果サマリーバー）
5. `tests/e2e/` と CI / デプロイ

期待値は [docs/11_unit_test_spec.md](docs/11_unit_test_spec.md) に確定値として記載済み。**期待値を実装に合わせて変えないこと。**

## プロジェクト固有の命名規則・コードスタイル

- Reactコンポーネント: PascalCase + `.tsx`（例 `ResultSummaryBar.tsx`）
- それ以外のファイル: camelCase + `.ts`（例 `baseCalculator.ts`）
- 型・インターフェース: PascalCase（`I` 接頭辞を付けない）
- 関数・変数: camelCase / 定数: UPPER_SNAKE_CASE
- CSVカラム名: snake_case / TSプロパティ: camelCase（変換は `data/csv/schemas.ts` に集約）
- ゲームデータのIDは日本語名称とは別に英数字（`power_hitter`, `velocity`）で保持する
- インデント2スペース / 行長100 / ダブルクォート / セミコロンあり
- `any` 禁止。外部データは `unknown` で受けて検証関数で確定させる

詳細は [docs/08_nonfunctional.md](docs/08_nonfunctional.md) §5。

## 絶対に守る設計原則

1. 不明なゲーム仕様をコードで推測しない
2. **データ不足を 0 として計算しない**（必ずエラーとして表示する）
3. 変化球の必要経験点を推定しない
4. `src/domain/` に React / Zustand / Papa Parse / idb を import しない
5. ゲーム固有の数値リテラルをコードに書かない
6. 外部への通信を一切行わない（CDN・Webフォント・解析を含む）

## 関連ドキュメント

- 確定仕様: `docs/` 配下（索引: [docs/00_index.md](docs/00_index.md)）
- 構成情報: [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md)
- プロジェクト固有ルール（テストレポート形式など）: [CLAUDE.md](CLAUDE.md)
- 原仕様書: `パワプロ サクセス必要経験点計算アプリ 仕様書.md`（v1.0・背景資料）
