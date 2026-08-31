# 09. 完成までのマイルストーン

MVP（`01_requirements.md` §6 の完了条件19項目）を満たすまでの工程。
各マイルストーンには**客観的な完了判定**を置き、判定を満たすまで次へ進まない。

規模の目安: **S** = 半日以内 / **M** = 1〜2日 / **L** = 3日以上（1人での作業を想定）

---

## 全体像

```text
M0 開発基盤
 └→ M1 ドメイン基盤 ─┬→ M2 基礎能力・青特 ─→ M3 金特・推定 ─→ M4 変化球・統合  ★計算エンジン完成
                     │
                     └→ M5 CSV読込・検証 ─→ M6 インデックス・ローダ ─→ M7 永続化
                                                                          │
                                              M4 ─────────────────────────┴→ M8 ストア
                                                                                │
                                            M9 UI骨格・選手設定 ─→ M10 基礎/特殊 ─→ M11 変化球/結果/プラン
                                                                                │
                                                                    M12 E2E・CI・デプロイ
                                                                                │
                                                                    M13 受け入れ試験  ★MVP完成
                                                                                │
                                                                    M14 実データ投入  ★実用開始
```

**クリティカルパス**: M0 → M1 → M2 → M3 → M4 → M8 → M9 → M10 → M11 → M12 → M13
M5〜M7（データ層）は M1 完了後であれば M2〜M4 と並行して進められる。

---

## マイルストーン一覧

| # | 名称 | 規模 | 主な成果物 | 完了判定 |
|---|---|---|---|---|
| M0 | 開発基盤セットアップ | S | 設定ファイル一式 | `npm run verify` が通る |
| M1 | ドメイン基盤（型・丸め・エラー） | S | `domain/models`, `rounding`, `errors` | UT-VEC / UT-RND が全 pass |
| M2 | 基礎能力・青特の計算 | M | `baseCalculator`, `blueCalculator` | UT-BASE / UT-BLUE が全 pass |
| M3 | 金特の計算と推定 | M | `goldCalculator`, `goldEstimator` | UT-GOLD / UT-EST が全 pass |
| M4 | 変化球とプラン統合 | M | `breakingCalculator`, `planCalculator` | UT-BR / UT-PLAN が全 pass、`domain` カバレッジ90% |
| M5 | CSV読込・検証 | M | `csvParser`, `schemas`, `validators`, フィクスチャ | UT-CSV / UT-VAL が全 pass |
| M6 | インデックス・ゲームローダ | S | `keyBuilder`, `indexBuilder`, `gameDataLoader` | UT-KEY / UT-IDX / UT-GAME が全 pass |
| M7 | 永続化・エクスポート | M | `db`, 各 Repository, `exporter` | UT-EXP が全 pass、保存・再読込が手元で動く |
| M8 | ストア層 | S | Zustand ストア4種 | 入力変更で再計算が走る |
| M9 | UI骨格・選手設定タブ | M | `App`, `ResultSummaryBar`, タブ1 | UI-CM / UI-T1 / UI-IM が全 ○ |
| M10 | 基礎能力・特殊能力タブ | L | タブ2・タブ3 | UI-T2 / UI-T3 が全 ○ |
| M11 | 変化球・結果・プラン管理 | L | タブ4・タブ5・プラン一覧 | UI-T4 / UI-T5 / UI-PL が全 ○ |
| M12 | E2E・CI・デプロイ | M | `tests/e2e`, CI/Pages ワークフロー | E2E-01〜11 が全 pass、Pages で動作 |
| M13 | 受け入れ試験 | S | 試験記録 | AT-01〜19 / AT-P-01〜08 が全 ○ ★**MVP完成** |
| M14 | 実データ投入 | — | `public/data/pawapro2024/` | 実際のサクセスで使える ★**実用開始** |

---

## 各マイルストーンの詳細

### M0 開発基盤セットアップ（S）

| 項目 | 内容 |
|---|---|
| 作業 | Vite（react-ts）初期化 / 依存導入 / `tsconfig.json`（`strict` + `noUncheckedIndexedAccess` 等）/ `eslint.config.js`（**`domain` の import 制限を含む**）/ `.prettierrc` / `vite.config.ts`（`base: "./"`, `esbuild.drop`）/ `vitest.config.ts`（環境切替・カバレッジ閾値）/ `playwright.config.ts` / npm scripts |
| 参照 | `08_nonfunctional.md` §2〜§7 |
| 完了判定 | `npm run verify` が（テスト0件の状態で）成功する。`src/domain/` から `react` を import すると Lint が落ちることを確認 |
| 落とし穴 | `base: "./"` を忘れると GitHub Pages で 404 になる。CSV を絶対パスで fetch しないこと |

### M1 ドメイン基盤（S）

| 項目 | 内容 |
|---|---|
| 作業 | `models/expVector.ts` `models/ability.ts` `models/plan.ts` `models/gameData.ts` `models/result.ts` `rounding.ts` `errors/errorCodes.ts` `errors/appError.ts` |
| 参照 | `04_calculation_spec.md` §1〜§2 / `07_error_spec.md` §2 |
| テスト | UT-VEC-01〜05 / UT-RND-01〜05 |
| 完了判定 | 上記テストが全 pass。特に **UT-RND-04**（`240 × 0.7` の浮動小数点誤差で `167` にならない）が通ること |

### M2 基礎能力・青特の計算（M）

| 項目 | 内容 |
|---|---|
| 作業 | `calculator/baseCalculator.ts` `calculator/blueCalculator.ts` |
| 参照 | `04_calculation_spec.md` §3〜§4 |
| テスト | UT-BASE-01〜10 / UT-BLUE-01〜12 |
| 完了判定 | 全 pass。特に **UT-BASE-10**（欠落段階を0補完しない）と **UT-BLUE-10**（丸めを最後に1回だけ）が通ること |
| 落とし穴 | 段階ごとに丸めると UT-BLUE-10 が `{2,3,5,6,8}` になり落ちる。これが仕様違反の検出器 |

### M3 金特の計算と推定（M）

| 項目 | 内容 |
|---|---|
| 作業 | `calculator/goldCalculator.ts` `estimator/goldEstimator.ts` |
| 参照 | `04_calculation_spec.md` §5〜§6 |
| テスト | UT-GOLD-01〜08 / UT-EST-01〜09 |
| 完了判定 | 全 pass。実測がある Lv で推定処理が走らないこと（UT-GOLD-02）、同点時に小さい B を採る（UT-EST-02）ことを確認 |
| 落とし穴 | 金特にコツ倍率・センス倍率を重ねて適用しない（UT-GOLD-07 / 08 が検出器）。B の探索はカテゴリごとに独立 |

### M4 変化球とプラン統合（M）

| 項目 | 内容 |
|---|---|
| 作業 | `calculator/breakingCalculator.ts` `calculator/planCalculator.ts` |
| 参照 | `04_calculation_spec.md` §7〜§8 |
| テスト | UT-BR-01〜10 / UT-PLAN-01〜14 |
| 完了判定 | 全 pass、かつ **`src/domain/` の行カバレッジ 90%以上**。★ここで計算エンジンが完成し、UIなしで仕様の中核が検証済みになる |
| 落とし穴 | 青特マージ（§8.1）の二重計上。UT-PLAN-03 / 06 が検出器 |

### M5 CSV読込・検証（M）

| 項目 | 内容 |
|---|---|
| 作業 | `csv/csvParser.ts` `csv/schemas.ts` `csv/validators.ts` / `tests/fixtures/csv/{valid,invalid,bom}` の作成 |
| 参照 | `03_data_spec.md` §1〜§11 / `10_test_plan.md` §4 |
| テスト | UT-CSV-01〜09 / UT-VAL-01〜19 |
| 完了判定 | 検証ルール V-01〜V-26 がすべて実装され、`invalid/` の各フィクスチャで期待コードが返る。エラーが全件（最初の1件で打ち切らず）収集される |

### M6 インデックス・ゲームローダ（S）

| 項目 | 内容 |
|---|---|
| 作業 | `repositories/keyBuilder.ts` `repositories/indexBuilder.ts` `repositories/gameDataLoader.ts` |
| 参照 | `04_calculation_spec.md` §10 / `02_architecture.md` §5 |
| テスト | UT-KEY-01〜05 / UT-IDX-01〜03 / UT-GAME-01〜06 |
| 完了判定 | ゲーム切替で前バージョンのデータが残らない（UT-GAME-01）。検索がすべて Map 参照（線形探索なし） |

### M7 永続化・エクスポート（M）

| 項目 | 内容 |
|---|---|
| 作業 | `persistence/db.ts` `planRepository` `overrideRepository` `breakingCacheRepository` `exporter.ts` |
| 参照 | `06_persistence_spec.md` |
| テスト | UT-EXP-01〜05（純粋な整形関数のみ。IndexedDB 本体は M12 の E2E で検証） |
| 完了判定 | プランの保存・読込・複製・削除が手元で動く。CSV 出力に BOM が付く |

### M8 ストア層（S）

| 項目 | 内容 |
|---|---|
| 作業 | `useGameDataStore` `usePlanStore` `usePlanListStore` `useResultStore` / 200ms デバウンス再計算 / 500ms デバウンス自動保存 |
| 参照 | `02_architecture.md` §6 / `06_persistence_spec.md` §3 |
| 完了判定 | 入力変更 → 再計算 → 結果反映が動く。**ストアに計算式が書かれていない**こと |

### M9 UI骨格・選手設定タブ（M）

| 項目 | 内容 |
|---|---|
| 作業 | `App.tsx`（タブレイアウト）/ `ResultSummaryBar` / `ExpVectorTable` / `SourceBadge` / `PlanSettingTab` / `CsvImportPanel` / `data-testid` 付与 |
| 参照 | `05_ui_spec.md` §1〜§3 / `13_e2e_test_spec.md` §3 |
| 試験 | UI-CM-01〜08 / UI-T1-01〜10 / UI-IM-01〜08 |
| 完了判定 | 全タブでサマリーバーが常時表示される。ロードエラーが全件表示される。**外部通信0件**（UI-CM-07） |

### M10 基礎能力・特殊能力タブ（L）

| 項目 | 内容 |
|---|---|
| 作業 | `BaseAbilityTab` / `SpecialAbilityTab` / `AbilityPicker` / `HintLevelSelect` |
| 参照 | `05_ui_spec.md` §4〜§5 |
| 試験 | UI-T2-01〜12 / UI-T3-01〜24 |
| 完了判定 | 金特選択で下位青特が自動追加され、手動指定と重複しない（UI-T3-15 / 16）。能力項目が `base_ability_defs.csv` から生成される |
| 落とし穴 | 本 MVP で最も UI 実装量が多い。青特のマージ表示（🔗併記）を先に設計しておくと手戻りが減る |

### M11 変化球・結果・プラン管理（L）

| 項目 | 内容 |
|---|---|
| 作業 | `BreakingBallTab` / `ResultTab` / `IssueList` / `PlanListDialog` / エクスポートボタン |
| 参照 | `05_ui_spec.md` §6〜§8 |
| 試験 | UI-T4-01〜16 / UI-T5-01〜13 / UI-PL-01〜11 |
| 完了判定 | 未計測の変化球が 0 にならず「未計測」と出る（UI-T4-04 / 05）。キャッシュ登録 → 再読込 → 自動入力が動く |

### M12 E2E・CI・デプロイ（M）

| 項目 | 内容 |
|---|---|
| 作業 | `tests/e2e/specs/` 11シナリオ / E2E専用データ `sample_alt` の追加 / `.github/workflows/ci.yml` / `deploy.yml` / GitHub Pages を「GitHub Actions」ソースに設定 |
| 参照 | `13_e2e_test_spec.md` / `08_nonfunctional.md` §8 |
| 完了判定 | E2E-01〜11 が全 pass。CI が green。Pages の URL でアプリが動作する |
| 落とし穴 | Pages には実測データが含まれない（`.gitignore` 対象）。公開版はサンプルデータ + CSVインポート運用になる |

### M13 受け入れ試験（S）★MVP完成

| 項目 | 内容 |
|---|---|
| 作業 | `12_ui_test_spec.md` の全項目を実施し判定欄を記入 / `14_acceptance_test.md` の AT-00 / AT-01〜19 / AT-P-01〜08 を実施 |
| 完了判定 | 全項目 ○。特に **AT-19（`src/` を1行も変更せずに新ゲームを追加できる）** に合格すること |
| 落とし穴 | AT-19 が落ちる場合、どこかにゲーム固有の値がコードへ漏れている。設計の根幹に関わるため重要度A扱い |

### M14 実データ投入（—）★実用開始

| 項目 | 内容 |
|---|---|
| 作業 | ゲーム画面を見ながら `public/data/pawapro2024/` の各CSVへ実測値を入力する（**利用者作業**、Git管理外） |
| 順序の目安 | ① `hint_rules` `config` → ② よく使う基礎能力（球速・コントロール・スタミナ／ミート・パワー） → ③ 使う予定の青特 → ④ 狙う金特（まず1つのコツLvだけでよい。残りは推定が効く） → ⑤ 変化球は作る選手ごとに実測 |
| 完了判定 | 実際に育成する1人分の計算が「確定」または「推定含む」で完了する |
| 補足 | 全データを揃える必要はない。**使う分だけ入れれば動く**設計になっている（不足は明示される） |

---

## 進捗チェックリスト

```text
[x] M0  開発基盤セットアップ
[x] M1  ドメイン基盤（型・丸め・エラー）
[x] M2  基礎能力・青特の計算
[x] M3  金特の計算と推定
[x] M4  変化球とプラン統合        ★計算エンジン完成
[x] M5  CSV読込・検証
[x] M6  インデックス・ゲームローダ
[x] M7  永続化・エクスポート
[x] M8  ストア層
[x] M9  UI骨格・選手設定タブ
[x] M10 基礎能力・特殊能力タブ
[ ] M11 変化球・結果・プラン管理
[ ] M12 E2E・CI・デプロイ
[ ] M13 受け入れ試験              ★MVP完成
[ ] M14 実データ投入              ★実用開始
```

---

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| M10・M11 の UI 実装量が想定を超える | 全体が遅延する | M4 の時点で計算エンジンは完成しているため、UI を簡素化しても MVP の価値は成立する。装飾より `data-testid` と表示規則を優先する |
| 実測データの収集（M14）が重い | 実用開始が遅れる | 全件揃える必要はない。金特は1Lvだけ実測すれば推定が効く。使う能力から順に入れる |
| AT-19 が落ちる | 設計の根幹に関わる | M0 の Lint 設定（`domain` の import 制限）と、M2 以降で「数値リテラルを書かない」を都度確認する |
| 変化球の実測が現実的に集まらない | 変化球経験点が常に未入力になる | 一括実測方式（合計だけ入力）を必ず先に実装する。ステップ方式は後回しでよい |
| ゲーム側の仕様変更（新作） | データが使えなくなる | CSV差し替えで対応する設計。ランク段数の変更のみ本仕様の改訂が必要 |
