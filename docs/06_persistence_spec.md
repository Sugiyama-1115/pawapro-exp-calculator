# 06. 保存・インポート・エクスポート仕様

サーバーは使用しない。すべてブラウザ内で完結する。

---

## 1. IndexedDB スキーマ

`idb` パッケージを使用する。

| 項目 | 値 |
|---|---|
| データベース名 | `pawapro-exp-calculator` |
| バージョン | `1` |

### オブジェクトストア

| ストア名 | keyPath | インデックス | 内容 |
|---|---|---|---|
| `plans` | `id` | `by_updatedAt` (`updatedAt`), `by_gameId` (`gameId`) | 選手計画（`PlayerPlan`） |
| `overrides` | `[gameId, kind]` | — | インポートで上書きしたCSVデータ |
| `breakingCache` | `[gameId, senseMode, cacheKey]` | `by_game` (`[gameId, senseMode]`) | 変化球共通キャッシュへの追記分 |
| `appState` | `key` | — | UI状態（最後に選択したゲーム・タブ等） |

### `overrides` レコード

```ts
interface OverrideRecord {
  gameId: string;
  kind: OverrideKind;    // 下表
  rows: unknown[];       // 検証済みの行オブジェクト配列
  rowCount: number;
  importedAt: string;    // ISO8601
  fileName: string;
}

type OverrideKind =
  | "config"
  | "base_ability_defs"
  | "base_sense_plus"
  | "base_normal"
  | "blue_abilities"
  | "gold_abilities"
  | "gold_prerequisites"
  | "hint_rules"
  | "breaking_cache_sense_plus"
  | "breaking_cache_normal";
```

### `appState` レコード

| key | 値 |
|---|---|
| `lastGameId` | 最後に選択したゲームID |
| `lastPlanId` | 最後に開いていたプランID |
| `lastTab` | 最後に開いていたタブ番号（1〜5） |
| `schemaVersion` | 保存データのスキーマ版（現在 `1`） |

### マイグレーション方針

`schemaVersion` が現行より小さいレコードを読み込んだ場合、変換関数を通す。変換関数が存在しないバージョンのデータは読み込まず、
「保存データのバージョンが対応していません」と表示して当該プランをスキップする（他のプランは読み込む）。**黙って壊れたデータを読み込んではならない。**

---

## 2. データ解決の優先順位

ゲームデータの取得は以下の順で解決する。

```text
1. overrides ストア（インポートデータ） … 種別単位で丸ごと置換
2. public/data/<directory>/*.csv        … 標準データ
```

- 優先は**種別単位の全置換**であり、行単位のマージは行わない。
- 変化球キャッシュのみ例外で、`breakingCache` ストアの内容を標準CSVへ**追記マージ**する。
  キーが重複した場合は `breakingCache` ストア（ユーザーが登録した値）を優先する。

---

## 3. 自動保存

| 対象 | タイミング |
|---|---|
| `plans` | プラン編集から 500ms デバウンス後。`updatedAt` を更新する。 |
| `appState` | ゲーム選択・タブ切替・プランを開いた直後（即時） |
| `overrides` | CSVインポートの検証成功直後（即時） |
| `breakingCache` | 「共通キャッシュへ登録」ボタン押下時（即時） |

保存失敗時（容量超過等）は画面上部に警告バーを表示し、**入力内容は破棄しない**。

---

## 4. エクスポート

すべてブラウザのダウンロードとして出力する（`Blob` + `URL.createObjectURL`）。

| 種別 | 形式 | ファイル名 |
|---|---|---|
| 選手計画 | JSON | `plan_<選手名>_<YYYYMMDD_HHmmss>.json` |
| 計算結果 | JSON | `result_<選手名>_<YYYYMMDD_HHmmss>.json` |
| 計算結果 | CSV | `result_<選手名>_<YYYYMMDD_HHmmss>.csv` |
| 変化球実測値 | CSV | `breaking_cache_<senseMode>_<YYYYMMDD_HHmmss>.csv` |
| 金特実測値 | CSV | `gold_abilities_<YYYYMMDD_HHmmss>.csv` |

- ファイル名の `<選手名>` に使えない文字（`\ / : * ? " < > |`）は `_` へ置換する。
- **CSV出力は UTF-8 BOM付き**とする（Excel での文字化けを防ぐため）。
- JSON出力は UTF-8 BOM無し・2スペースインデント。

### 4.1 計算結果CSVの形式

```csv
category,id,display_name,detail,source,muscle,agility,technique,breaking,mental
base,velocity,球速,130 → 155,master,900,0,500,0,0
blue,strikeout,奪三振,NONE → ON / コツLv3,master,25,0,57,36,25
gold,doctor_k,ドクターK,コツLv4,estimated,44,0,102,64,44
breaking,breaking_total,変化球,スライダー4 / カーブ3 / フォーク5,manual,0,0,450,1280,100
subtotal,base,基礎能力小計,,,900,0,950,0,300
total,total,合計,,,1820,430,2240,1650,1310
```

### 4.2 プランJSONの形式

`PlayerPlan` をそのまま出力し、ラッパを付与する。

```json
{
  "format": "pawapro-exp-calculator/plan",
  "formatVersion": 1,
  "exportedAt": "2026-08-30T14:22:31.000Z",
  "plan": { }
}
```

---

## 5. インポート

### 5.1 CSVインポート（ゲームデータ）

1. ファイル選択（`accept=".csv,text/csv"`）
2. UTF-8 として読み込む（BOMがあれば除去）
3. 種別に応じたスキーマで検証（`03_data_spec.md` §11）
4. 検証成功 → `overrides` ストアへ保存し、ゲームデータを再構築
5. 検証失敗 → **一切適用せず**、エラー一覧を表示

- ファイルサイズ上限 20MB。超過時は `INVALID_CSV` として拒否する。
- 検証は種別単位で完結させる。ただし参照整合検証（V-18〜V-22）は再構築後のデータセット全体に対して行い、
  ここで失敗した場合もインポートを適用しない。

### 5.2 プランJSONインポート

1. ファイル選択（`accept=".json,application/json"`）
2. `format` が `pawapro-exp-calculator/plan` であることを確認。異なれば拒否。
3. `formatVersion` が対応範囲内であることを確認。
4. `plan.id` が既存プランと衝突する場合は**新しい `id` を採番**して別プランとして追加する（上書きしない）。
5. `plan.gameId` が `games.json` に存在しない場合、警告を表示したうえで追加は行う（計算時にデータ不足として報告される）。

---

## 6. 容量とクリーンアップ

| 項目 | 規定 |
|---|---|
| 想定容量 | プラン1件あたり 20KB 以下、overrides 全体で 20MB 以下 |
| 容量超過時 | 保存失敗を検知し「ブラウザの保存容量が不足しています。不要なプランを削除してください。」と表示 |
| 全消去 | 設定として「保存データをすべて削除」を提供する `[SHOULD]`。実行前に確認ダイアログ必須。 |

---

## 7. プライバシー・外部通信

- **外部への通信を一切行ってはならない。** アナリティクス、エラー収集サービス、CDN、Webフォントを含む。
- ビルド成果物は同一オリジンの静的ファイルのみを参照すること。
- ユーザーが入力したデータはブラウザ外へ送出されない。この旨をアプリ内の「このアプリについて」に明記する。
