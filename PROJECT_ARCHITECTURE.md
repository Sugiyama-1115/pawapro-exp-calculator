# Project Architecture

## プロジェクト概要

パワプロ（eBASEBALLパワフルプロ野球）のサクセスモードで育成する選手について、初期基礎能力・初期特殊能力・取得済み／取得予定のコツ・目標基礎能力・目標特殊能力・目標変化球を入力すると、完成までに必要な経験点（筋力・敏捷・技術・変化球・精神）を計算するアプリ。初期対応タイトルは eBASEBALLパワフルプロ野球2024-2025（パワフルフューチャーズ）。ゲーム固有の数値データ（基礎能力・青特殊能力・金特殊能力・コツ倍率など）はプログラムコードに直接書かず、CSVとして分離管理し、新作発売時は原則CSVの差し替えのみで対応できる設計とする。

## ディレクトリ構造

```
pawapro-exp-calculator/
├── .claude/
│   └── memory/         # Claude のプロジェクトメモリ
├── CLAUDE.md           # プロジェクト固有ルール
├── Instructions.md     # プロジェクト概要・セットアップガイド
└── PROJECT_ARCHITECTURE.md  # 構成情報（このファイル）
```

（今後、以下のような構成を想定。実装着手時に確定・追記する）

```
pawapro-exp-calculator/
├── data/
│   └── pawapro2024/
│       ├── config.csv
│       ├── base_sense_plus.csv
│       ├── base_normal.csv
│       ├── blue_abilities.csv
│       ├── gold_abilities.csv
│       ├── gold_prerequisites.csv
│       ├── hint_rules.csv
│       ├── breaking_cache_sense_plus.csv
│       └── breaking_cache_normal.csv
├── src/
│   ├── domain/
│   │   ├── calculator/   # 経験点計算エンジン（ゲーム固有仕様を知らない）
│   │   ├── models/       # ExpVector, PlayerPlan 等の型定義
│   │   └── estimator/    # 金特未計測コツLvの推定ロジック
│   ├── data/
│   │   ├── csvLoader/    # CSV読み込み・検証
│   │   └── repositories/ # CSVキャッシュへのアクセス
│   └── ui/                # 選手設定・基礎能力・特殊能力・変化球・結果画面
└── ...
```

## アーキテクチャ図

（モジュール間の依存関係を Mermaid 等で記載。後から追記）

```
（基本データフロー）
ゲームデータ（CSV）
    ↓
CSV Loader
    ↓
Calculation Engine（ゲーム固有数値を知らない）
    ↓
選手作成画面（UI）
    ↓
必要経験点結果
```

## モジュール一覧と役割

| モジュール / ファイル | 役割 |
|---|---|
| （後から記載） | （後から記載） |

## データモデル

（DB スキーマ、重要なオブジェクト構造を記載。後から追記。仕様書の ExpVector / PlayerPlan / CalculationResult / CalculationItem 等の型定義を参照）

## 入出力・外部インターフェース

- API: なし（サーバーレス、ブラウザ完結）
- ファイルフォーマット: CSV（UTF-8、BOM付き許容、カンマ区切り）。エクスポートはCSVまたはJSON
- 外部サービス連携: なし

## エントリーポイント

- 実行開始ファイル: （例: `src/main.tsx`、後から確定）
- 起動コマンド: （例: `npm run dev`、後から確定）

## 既知の問題・TODO

- [ ] 技術スタックの最終確定（React + TypeScript + Vite を想定）
- [ ] CSVデータ（パワプロ2024-2025分）の準備
- [ ] 計算エンジンの実装（基礎能力・青特・金特・変化球）
- [ ] 金特未計測コツLv推定アルゴリズムの実装
- [ ] UI画面（選手設定・基礎能力・特殊能力・変化球・計算結果）の実装
