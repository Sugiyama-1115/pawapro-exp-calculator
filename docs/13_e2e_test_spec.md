# 13. E2Eテスト仕様（Playwright）

---

## 1. 実行設定

`playwright.config.ts` の必須項目。

```ts
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,          // IndexedDB を共有するため直列実行
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    locale: "ja-JP",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 前提条件

- 使用データは `public/data/sample2024/`（`11_unit_test_spec.md` §1 と同一内容とする）。
- 各テストの `beforeEach` で **IndexedDB を全消去**し、初期状態から開始する。
- 外部通信は発生しない。`page.route("**", ...)` で外部ドメインへのリクエストを検知したら失敗させるガードを全テストに入れる（E2E-10）。

---

## 2. シナリオ一覧

| ID | シナリオ | 対応要件 |
|---|---|---|
| E2E-01 | 初回起動〜基礎能力の計算 | FR-D-01, FR-B-01〜03, FR-R-01 |
| E2E-02 | 青特（binary / rank）の計算 | FR-BL-01〜07 |
| E2E-03 | 金特の前提自動追加と重複排除 | FR-G-02, FR-G-04, FR-G-05 |
| E2E-04 | 金特の実測と推定の区別 | FR-G-06〜09 |
| E2E-05 | 変化球（一括入力）とキャッシュ再利用 | FR-BR-02〜06 |
| E2E-06 | データ不足の検出（0にしない） | FR-B-06, FR-BR-05, FR-R-04 |
| E2E-07 | プランの保存・再読み込み・複製・削除 | FR-P-02〜06 |
| E2E-08 | CSVインポートと破棄 | FR-D-06〜08 |
| E2E-09 | ゲームバージョン切替 | FR-D-02, FR-D-05 |
| E2E-10 | 外部通信が発生しないこと | 06§7 |
| E2E-11 | 結果のエクスポート | FR-R-07 |

---

## 3. `data-testid` 命名規則（実装必須）

E2Eから参照する要素には以下の `data-testid` を付与する。**命名を変更してはならない。**

| 要素 | testid |
|---|---|
| ゲーム選択 | `game-select` |
| タブボタン | `tab-plan` / `tab-base` / `tab-special` / `tab-breaking` / `tab-result` |
| 選手名入力 | `plan-name` |
| 選手種別ラジオ | `player-type-pitcher` / `player-type-fielder` |
| センス○ラジオ | `sense-plus` / `sense-normal` |
| 基礎能力の初期値 | `base-current-<abilityId>` |
| 基礎能力の目標値 | `base-target-<abilityId>` |
| 基礎能力の行 | `base-row-<abilityId>` |
| 能力検索欄 | `ability-search` |
| 検索結果の追加ボタン | `ability-add-<abilityId>` |
| 青特の行 | `blue-row-<abilityId>` |
| 青特の現在 / 目標 / コツLv | `blue-current-<abilityId>` / `blue-target-<abilityId>` / `blue-hint-<abilityId>` |
| 青特の自動追加マーク | `blue-auto-<abilityId>` |
| 金特の行 | `gold-row-<abilityId>` |
| 金特のコツLv / 下位コツLv | `gold-hint-<abilityId>` / `gold-lower-hint-<abilityId>` |
| 出どころバッジ | `source-badge-<category>-<id>` |
| 変化球の入力方式ラジオ | `breaking-mode-aggregate` / `breaking-mode-step` / `breaking-mode-none` |
| 変化球一括入力 | `breaking-aggregate-<expKey>` |
| 変化球ステップ行 | `breaking-step-<seq>` |
| キャッシュ登録ボタン | `breaking-cache-register` |
| サマリーバーの各値 | `summary-<expKey>` / `summary-total` |
| サマリーバーのステータス | `summary-status` |
| 不足件数 | `summary-issue-count` |
| 結果内訳の項目 | `result-item-<category>-<id>` |
| 不足データ一覧 | `issue-list` / `issue-item-<index>` |
| プラン一覧ボタン | `open-plan-list` |
| プラン一覧の行 | `plan-row-<planId>` |
| プラン操作ボタン | `plan-open-<planId>` / `plan-duplicate-<planId>` / `plan-delete-<planId>` |
| CSVインポート入力 | `csv-import-<kind>` |
| インポート破棄ボタン | `csv-discard-<kind>` |
| ロードエラーパネル | `load-error-panel` |

`<expKey>` は `muscle` / `agility` / `technique` / `breaking` / `mental`。

---

## 4. シナリオ詳細

### E2E-01 初回起動〜基礎能力の計算

```text
1. トップページを開く
2. game-select が sample2024 になっていることを確認
3. tab-base をクリック
4. base-current-velocity に 130、base-target-velocity に 133 を入力
5. base-current-control に 40、base-target-control に 41 を入力
6. 期待:
     summary-muscle    = "32"
     summary-agility   = "0"
     summary-technique = "20"    （velocity 16 + control 4）
     summary-breaking  = "0"
     summary-mental    = "3"
     summary-total     = "55"
     summary-status    = "確定"
```

### E2E-02 青特（binary / rank）の計算

```text
前提: 選手種別 = 野手、センス○ = なし（normal）
1. tab-special を開く
2. ability-search に "パワーヒッター" を入力し ability-add-power_hitter をクリック
3. blue-hint-power_hitter を 2 に設定
4. 期待: result-item-blue-power_hitter の値が 筋120/敏7/技34/変0/精4
5. ability-search に "チャンス" を入力し ability-add-chance をクリック
6. blue-current-chance = D, blue-target-chance = A, blue-hint-chance = 0
7. 期待: result-item-blue-chance の値が 筋0/敏60/技105/変0/精375
8. blue-target-chance を D に戻す
9. 期待: result-item-blue-chance の値がすべて 0
```

### E2E-03 金特の前提自動追加と重複排除

```text
前提: 選手種別 = 野手、センス○ = あり（sense_plus）
1. tab-special を開く
2. ability-add-archartist をクリック（金特アーチスト）
3. 期待: blue-row-power_hitter が存在し、blue-auto-power_hitter が表示される
4. gold-lower-hint-archartist を 2 に設定
5. ability-add-power_hitter をクリック（手動でも追加）
6. 期待: blue-row-power_hitter が 1件のみ（count = 1）
7. blue-hint-power_hitter を 4 に設定
8. 期待: result-item-blue-power_hitter の値が 筋64/敏4/技18/変0/精2
        （240×0.30×0.90=64.8→64 / 15×0.27=4.05→4 / 68×0.27=18.36→18 / 8×0.27=2.16→2）
9. gold-row-archartist を削除
10. 期待: blue-row-power_hitter は残る（手動追加分）が blue-auto-power_hitter は消える
```

### E2E-04 金特の実測と推定の区別

```text
前提: 選手種別 = 野手、センス○ = あり
1. ability-add-archartist をクリック
2. gold-hint-archartist を 1 に設定
3. 期待: source-badge-gold-archartist = "実測"、値が 筋100/敏10/技50/変0/精20
4. gold-hint-archartist を 2 に変更
5. 期待: source-badge-gold-archartist = "高信頼推定"、値が 筋71/敏7/技36/変0/精14
6. 選手種別を投手に変更（確認ダイアログをOK）
7. ability-add-doctor_k をクリックし gold-hint-doctor_k を 3 に設定
8. 期待: source-badge-gold-doctor_k = "推定"、値が 筋28/敏0/技57/変40/精23
9. summary-status = "推定含む"
```

### E2E-05 変化球（一括入力）とキャッシュ再利用

```text
前提: 選手種別 = 投手、センス○ = あり
1. tab-breaking を開く
2. 球種を スライダー4 / カーブ3 / フォーク5 で追加
3. 期待: summary-status = "未完成"、issue-list に BREAKING_DATA_MISSING が出る
4. breaking-mode-aggregate を選択し 0/0/450/1280/100 を入力
5. 期待: summary-technique に 450、summary-breaking に 1280 が含まれる
        source-badge-breaking = "手動入力"
6. breaking-mode-step に切り替える
7. ステップ1 に slider / from=1 / totalBreakBefore=1 / pitchCountBefore=1 を入力
8. 期待: 経験点が 0/0/10/50/0 で自動入力され source-badge = "実測"
9. ステップ2 に slider / from=1 / totalBreakBefore=9 / pitchCountBefore=1 を入力
10. 期待: 「未登録」と表示され、経験点が 0 として計上されない
11. ステップ2 に 0/0/15/70/0 を入力し breaking-cache-register をクリック
12. ページを再読み込みし、同じキーを入力する
13. 期待: 0/0/15/70/0 が自動入力され source-badge = "実測"
```

### E2E-06 データ不足の検出

```text
前提: 選手種別 = 投手、センス○ = あり
1. tab-base で base-current-velocity=133, base-target-velocity=135
   （134→135 の行がサンプルデータに無い）
2. 期待:
     issue-list に BASE_DATA_MISSING が1件
     summary-status = "未完成"
     summary-muscle = "12"（134→135 分が 0 で補完されていないこと）
3. base-target-velocity を 134 に戻す
4. 期待: summary-status = "確定"、issue-list が非表示
```

### E2E-07 プランの保存・再読み込み・複製・削除

```text
1. plan-name に "エース候補A" を入力し基礎能力を入力
2. ページを再読み込み
3. 期待: plan-name が "エース候補A"、基礎能力の入力値と合計が保持されている
4. open-plan-list → plan-duplicate-<id> をクリック
5. 期待: "エース候補A のコピー" が一覧に増える
6. 複製先を開き選手名を変更 → 元プランを開く
7. 期待: 元プランの名前が変わっていない
8. open-plan-list → plan-delete-<id> をクリック → 確認ダイアログをOK
9. 期待: 一覧から消える。再読み込み後も復活しない
```

### E2E-08 CSVインポートと破棄

```text
1. tab-plan の CSVインポートで、青特の muscle を 2倍にしたCSVをアップロード
2. 期待: 「インポート済」表示になり、青特の計算値が2倍になる
3. ページを再読み込み
4. 期待: インポート状態が維持されている
5. csv-discard-blue_abilities をクリック
6. 期待: 標準データの値に戻る
7. 検証エラーを含むCSV（負値を含む）をアップロード
8. 期待: エラー一覧が表示され、計算値は変わらない
```

### E2E-09 ゲームバージョン切替

```text
前提: sample2024 に加え、テスト用の第2ゲーム sample_alt を public/data に用意する
      （E2E専用。base_sense_plus の velocity 130→131 の値を sample2024 と変える）
1. sample2024 で velocity 130→131 を入力し合計を記録
2. game-select を sample_alt に変更（確認ダイアログをOK）
3. 期待: 合計が sample_alt の値に変わる
4. game-select を sample2024 に戻す
5. 期待: 合計が元の値に戻る
6. 期待: どの時点でも両ゲームの値が混ざらない
```

### E2E-10 外部通信が発生しないこと

```text
1. page.route("**/*", route => { 同一オリジン以外なら test.fail() }) を仕込む
2. 全タブを操作し、CSVインポート・エクスポート・プラン保存まで一通り実行する
3. 期待: 外部ドメインへのリクエストが0件
```

### E2E-11 結果のエクスポート

```text
1. 基礎能力・青特・金特・変化球をすべて入力する
2. [結果をCSVで保存] をクリックし download イベントを取得する
3. 期待: ファイル名が result_<選手名>_<日時>.csv
        先頭がUTF-8 BOM
        ヘッダが category,id,display_name,detail,source,muscle,agility,technique,breaking,mental
        subtotal 4行と total 1行を含む
4. [プランをJSONで保存] をクリック
5. 期待: format = "pawapro-exp-calculator/plan"
```

---

## 5. 合格基準

- 全11シナリオが PASS すること。
- 各シナリオの期待値は `11_unit_test_spec.md` の標準フィクスチャから導かれる確定値であり、変更してはならない。
- Playwright の `trace` は失敗時のみ保存し、レポート（`playwright-report/`）を成果物に含める。
