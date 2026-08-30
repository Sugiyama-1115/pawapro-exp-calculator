# 11. 単体テスト仕様（Vitest）

本章の期待値は `04_calculation_spec.md` の仕様から一意に導かれる。**期待値を実装に合わせて変更してはならない。**
期待値と実装が食い違う場合は実装を修正すること。

---

## 1. 標準フィクスチャ（`tests/fixtures/csv/valid/`）

以下を確定内容とする。本章の期待値はすべてこのデータに基づく。
**`public/data/sample2024/` と同一内容**とし、E2E・手動UI試験もこのデータで実施する（差異が生じると期待値が崩れる）。

### `config.csv`

```csv
key,value
blue_sense_plus_multiplier,0.90
blue_normal_multiplier,1.00
gold_estimate_search_max,10000
```

### `hint_rules.csv`

```csv
ability_type,hint_level,multiplier,rounding
blue,0,1.00,floor
blue,1,0.70,floor
blue,2,0.50,floor
blue,3,0.40,floor
blue,4,0.30,floor
blue,5,0.20,floor
gold,0,1.00,floor
gold,1,0.70,floor
gold,2,0.50,floor
gold,3,0.40,floor
gold,4,0.30,floor
gold,5,0.20,floor
```

### `base_ability_defs.csv`

```csv
ability_id,display_name,player_type,min_value,max_value,display_order,value_type
trajectory,弾道,fielder,1,4,10,trajectory
contact,ミート,fielder,1,100,20,numeric
power,パワー,fielder,1,100,30,numeric
velocity,球速,pitcher,100,170,10,numeric
control,コントロール,pitcher,1,100,20,numeric
stamina,スタミナ,pitcher,1,100,30,numeric
```

### `base_sense_plus.csv`

```csv
player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental
pitcher,velocity,128,129,10,0,5,0,0
pitcher,velocity,129,130,10,0,5,0,0
pitcher,velocity,130,131,10,0,5,0,0
pitcher,velocity,131,132,10,0,5,0,0
pitcher,velocity,132,133,12,0,6,0,0
pitcher,velocity,133,134,12,0,6,0,0
pitcher,control,40,41,0,0,4,0,3
pitcher,control,41,42,0,0,4,0,3
pitcher,stamina,40,41,0,0,3,0,5
fielder,contact,40,41,1,0,5,0,7
fielder,contact,41,42,1,0,5,0,7
fielder,contact,42,43,1,0,6,0,8
fielder,contact,43,44,1,0,6,0,8
fielder,contact,44,45,2,0,7,0,9
fielder,power,40,41,5,0,1,0,7
fielder,trajectory,1,2,50,0,0,0,20
fielder,trajectory,2,3,80,0,0,0,35
fielder,trajectory,3,4,120,0,0,0,50
```

※ `velocity 134→135` の行は**意図的に存在しない**（データ不足テスト用）。

### `base_normal.csv`

```csv
player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental
pitcher,velocity,130,131,20,0,10,0,0
pitcher,velocity,131,132,20,0,10,0,0
fielder,contact,40,41,2,0,10,0,14
```

### `blue_abilities.csv`

```csv
ability_id,display_name,player_type,ability_type,from_state,to_state,hint_level,sense_mode,muscle,agility,technique,breaking,mental
power_hitter,パワーヒッター,fielder,binary,NONE,ON,0,normal,240,15,68,0,8
average_hitter,アベレージヒッター,fielder,binary,NONE,ON,0,normal,23,38,195,0,83
average_hitter,アベレージヒッター,fielder,binary,NONE,ON,2,normal,12,20,100,0,45
strikeout,奪三振,pitcher,binary,NONE,ON,0,normal,35,0,80,50,35
test_round,丸め検証,common,binary,NONE,ON,0,normal,5,7,9,11,13
chance,チャンス,fielder,rank,G,F,0,normal,0,8,14,0,50
chance,チャンス,fielder,rank,F,E,0,normal,0,10,18,0,62
chance,チャンス,fielder,rank,E,D,0,normal,0,13,22,0,80
chance,チャンス,fielder,rank,D,C,0,normal,0,16,28,0,100
chance,チャンス,fielder,rank,D,C,1,normal,0,15,25,0,90
chance,チャンス,fielder,rank,C,B,0,normal,0,20,35,0,125
chance,チャンス,fielder,rank,B,A,0,normal,0,24,42,0,150
```

※ `average_hitter` の Lv2/normal 行と `chance` の D→C / Lv1/normal 行は**実測パス検証用**。いずれも基準行からの計算値と一致しない値を意図的に置いている（`average_hitter` Lv2/normal の計算値は `{11,19,97,0,41}`、`chance` D→C Lv1/normal の計算値は `{0,11,19,0,70}`）。

### `gold_abilities.csv`

```csv
ability_id,display_name,player_type,hint_level,sense_mode,muscle,agility,technique,breaking,mental,data_type
archartist,アーチスト,fielder,1,sense_plus,100,10,50,0,20,measured
archartist,アーチスト,fielder,3,sense_plus,60,6,30,0,12,measured
doctor_k,ドクターK,pitcher,1,sense_plus,50,0,100,70,40,measured
clutch_master,クラッチマスター,fielder,0,sense_plus,300,30,150,0,60,measured
laser_beam,レーザービーム,fielder,1,sense_plus,80,40,60,0,20,measured
```

※ `laser_beam` は `gold_prerequisites.csv` に行を持たない（前提なし金特のテスト用）。

### `gold_prerequisites.csv`

```csv
gold_id,lower_blue_id,required_state
archartist,power_hitter,ON
doctor_k,strikeout,ON
clutch_master,chance,A
```

### `breaking_cache_sense_plus.csv`

```csv
pitch_type,from_level,to_level,total_break_before,pitch_count_before,muscle,agility,technique,breaking,mental
slider,1,2,1,1,0,0,10,50,0
slider,2,3,2,1,0,0,12,60,0
curve,0,1,3,1,0,0,25,110,0
```

### `breaking_cache_normal.csv`

```csv
pitch_type,from_level,to_level,total_break_before,pitch_count_before,muscle,agility,technique,breaking,mental
slider,1,2,1,1,0,0,20,100,0
```

---

## 2. ExpVector / 丸め（`tests/unit/domain/expVector.test.ts`, `rounding.test.ts`）

| ID | テスト名 | 検証内容 | 期待値 |
|---|---|---|---|
| UT-VEC-01 | `zeroVector` は全項目0 | 初期値 | `{0,0,0,0,0}` |
| UT-VEC-02 | `addVector` は各項目を加算 | `{1,2,3,4,5} + {10,20,30,40,50}` | `{11,22,33,44,55}` |
| UT-VEC-03 | `addVector` は引数を破壊しない | 引数の同一性 | 元オブジェクトが不変 |
| UT-VEC-04 | `sumVectors` は空配列でゼロ | `sumVectors([])` | `{0,0,0,0,0}` |
| UT-VEC-05 | `totalOf` は5項目の合計 | `{1,2,3,4,5}` | `15` |
| UT-RND-01 | `floor` は切り捨て | `applyRounding(3.9,"floor")` | `3` |
| UT-RND-02 | `ceil` は切り上げ | `applyRounding(3.1,"ceil")` | `4` |
| UT-RND-03 | `round` は 0.5 を切り上げ | `applyRounding(3.5,"round")` | `4` |
| UT-RND-04 | 浮動小数点誤差を正規化する | `240 * 0.7 = 168.00000000000003` を floor | `168`（`167` にならないこと） |
| UT-RND-05 | 誤差正規化が過剰でない | `applyRounding(2.9999,"floor")` | `2` |

---

## 3. 基礎能力（`tests/unit/domain/baseCalculator.test.ts`）

対象要件: FR-B-03 〜 FR-B-06 / 仕様 `04` §3

| ID | 条件 | 期待 cost | 期待 issues |
|---|---|---|---|
| UT-BASE-01 | pitcher / sense_plus / velocity 130→132 | `{20,0,10,0,0}` | なし |
| UT-BASE-02 | pitcher / sense_plus / velocity 130→133 | `{32,0,16,0,0}` | なし |
| UT-BASE-03 | pitcher / sense_plus / velocity 130→130 | `{0,0,0,0,0}` | なし |
| UT-BASE-04 | pitcher / sense_plus / velocity 133→130 | `{0,0,0,0,0}` | `INVALID_TARGET` 1件 |
| UT-BASE-05 | pitcher / sense_plus / velocity 133→135（134→135 が欠落） | `{12,0,6,0,0}` | `BASE_DATA_MISSING` 1件 |
| UT-BASE-06 | pitcher / **normal** / velocity 130→132 | `{40,0,20,0,0}` | なし（`base_normal.csv` を使用すること） |
| UT-BASE-07 | fielder / sense_plus / trajectory 1→2 | `{50,0,0,0,20}` | なし |
| UT-BASE-08 | pitcher / sense_plus / velocity 130→180（`max_value` 超過） | `{0,0,0,0,0}` | `INVALID_TARGET` 1件 |
| UT-BASE-09 | 未登録の `ability_id` | `{0,0,0,0,0}` | `BASE_DATA_MISSING` 1件 |
| UT-BASE-10 | **欠落段階を0補完しないこと** | UT-BASE-05 の cost が `{24,0,12,0,0}` に**ならない** | — |

---

## 4. 青特殊能力（`tests/unit/domain/blueCalculator.test.ts`）

対象要件: FR-BL-02 〜 FR-BL-08 / 仕様 `04` §4

| ID | 条件 | 期待 cost | 備考 |
|---|---|---|---|
| UT-BLUE-01 | `power_hitter` NONE→ON / コツLv0 / normal | `{240,15,68,0,8}` | 基準行に完全一致 → `source="measured"` |
| UT-BLUE-02 | `power_hitter` NONE→ON / コツLv2 / normal | `{120,7,34,0,4}` | `floor(15×0.5)=7` |
| UT-BLUE-03 | `power_hitter` NONE→ON / コツLv1 / sense_plus | `{151,9,42,0,5}` | `floor(240×0.7×0.9)=151` |
| UT-BLUE-04 | `chance` D→A / コツLv0 / normal | `{0,60,105,0,375}` | 3遷移の合計 |
| UT-BLUE-05 | `chance` D→D | `{0,0,0,0,0}` | issue なし |
| UT-BLUE-06 | `chance` A→D | `{0,0,0,0,0}` | `INVALID_TARGET` |
| UT-BLUE-07 | `chance` G→A / コツLv0 / normal | `{0,91,159,0,567}` | 6遷移の合計 |
| UT-BLUE-08 | 未登録の `ability_id` | `{0,0,0,0,0}` | `BLUE_DATA_MISSING` |
| UT-BLUE-09 | `chance` D→A / コツLv3 / sense_plus | `{0,21,37,0,135}` | `floor(60×0.4×0.9)=21` / `floor(105×0.36)=37` / `floor(375×0.36)=135` |
| UT-BLUE-10 | **丸めは最後に1回のみ** `test_round` NONE→ON / コツLv1 / sense_plus | `{3,4,5,6,8}` | 段階ごとに丸めると `{2,3,5,6,8}` になる。**この差で二重丸めを検出する** |
| UT-BLUE-11 | ランク遷移の1段階のみ加算 `chance` E→D / コツLv0 / normal | `{0,13,22,0,80}` | 他の遷移を含めないこと |
| UT-BLUE-12 | `player_type` 不一致の青特を選択 | — | `BLUE_DATA_MISSING` |
| UT-BLUE-13 | **実測パス** `average_hitter` NONE→ON / コツLv2 / normal | `{12,20,100,0,45}` | 完全一致行を倍率・丸めなしでそのまま使用。`source="measured"`。基準行計算値 `{11,19,97,0,41}` に**ならない** |
| UT-BLUE-14 | 実測行と `sense_mode` 不一致 `average_hitter` NONE→ON / コツLv2 / sense_plus | `{10,17,87,0,37}` | Lv2/normal 行は使わず基準行パス。`source="master"`。`floor(195×0.5×0.9)=87` |
| UT-BLUE-15 | **実測パスと基準行パスの混在禁止** `chance` D→A / コツLv1 / normal | `{0,42,73,0,262}` | D→C のみ実測行あり。区間全体を基準行パスで計算する。`source="master"`。実測混在なら `{0,45,78,0,282}` になる |
| UT-BLUE-16 | 単一遷移が完全一致 `chance` D→C / コツLv1 / normal | `{0,15,25,0,90}` | `source="measured"`。基準行計算値 `{0,11,19,0,70}` に**ならない** |
| UT-BLUE-17 | 実測行を持たない能力は原仕様と同結果 `strikeout` NONE→ON / コツLv2 / normal | `{17,0,40,25,17}` | 基準行パスのみ。`source="master"` |

---

## 5. 金特殊能力（`tests/unit/domain/goldCalculator.test.ts`）

対象要件: FR-G-06 〜 FR-G-09 / 仕様 `04` §5, §6

| ID | 条件 | 期待 cost | 期待 source |
|---|---|---|---|
| UT-GOLD-01 | `archartist` コツLv1 / sense_plus | `{100,10,50,0,20}` | `measured` |
| UT-GOLD-02 | `archartist` コツLv3 / sense_plus | `{60,6,30,0,12}` | `measured`（**推定しないこと**） |
| UT-GOLD-03 | `archartist` コツLv2 / sense_plus（Lv1・Lv3から推定） | `{71,7,36,0,14}` | `estimated_high` |
| UT-GOLD-04 | `doctor_k` コツLv3 / sense_plus（Lv1のみから推定） | `{28,0,57,40,23}` | `estimated` |
| UT-GOLD-05 | 未登録の金特 | `{0,0,0,0,0}` | — / `GOLD_DATA_MISSING` |
| UT-GOLD-06 | `archartist` コツLv1 / **normal**（normal の実測行なし） | `{0,0,0,0,0}` | `GOLD_DATA_MISSING`（sense_plus 行を流用しないこと） |
| UT-GOLD-07 | 金特にコツ倍率を二重適用しないこと | UT-GOLD-01 の値が `floor(100×0.7)` に**ならない** | — |
| UT-GOLD-08 | 金特にセンス倍率を適用しないこと | UT-GOLD-01 の値が `floor(100×0.9)` に**ならない** | — |

### 期待値の導出（検算用）

UT-GOLD-03: 実測 Lv1(R=0.70) と Lv3(R=0.40) から各カテゴリのBを総当たりで求める。

| カテゴリ | 実測 Lv1 | 実測 Lv3 | 最小誤差の B | Lv2 推定 `floor(B×0.5)` |
|---|---|---|---|---|
| muscle | 100 | 60 | 143（誤差3） | 71 |
| agility | 10 | 6 | 15（誤差0） | 7 |
| technique | 50 | 30 | 72（誤差2） | 36 |
| breaking | 0 | 0 | 0（誤差0） | 0 |
| mental | 20 | 12 | 29（誤差1） | 14 |

UT-GOLD-04: 実測 Lv1(R=0.70) のみ。

| カテゴリ | 実測 Lv1 | B | Lv3 推定 `floor(B×0.4)` |
|---|---|---|---|
| muscle | 50 | 72 | 28 |
| agility | 0 | 0 | 0 |
| technique | 100 | 143 | 57 |
| breaking | 70 | 100 | 40 |
| mental | 40 | 58 | 23 |

---

## 6. 推定器（`tests/unit/domain/goldEstimator.test.ts`）

対象仕様: `04` §6

| ID | テスト内容 | 期待 |
|---|---|---|
| UT-EST-01 | 単一実測からのB逆算 `M=100, R=0.70` | `B = 143` |
| UT-EST-02 | 同点時は小さいBを採用 `M=50, R=0.50`（B=100,101 がともに誤差0） | `B = 100` |
| UT-EST-03 | 複数実測で誤差合計が最小のBを採用 | UT-GOLD-03 の表と一致 |
| UT-EST-04 | 実測0のカテゴリはB=0 | `cost = 0` |
| UT-EST-05 | 信頼度: 実測2件以上 | `estimated_high` |
| UT-EST-06 | 信頼度: 実測1件 | `estimated` |
| UT-EST-07 | 探索上限を超えるBが必要な場合も例外を投げない | 上限内の最良Bを返す |
| UT-EST-08 | カテゴリごとに独立してBを求める | muscle と mental で異なるBが採用される（UT-GOLD-03 で 143 と 29） |
| UT-EST-09 | 実測行が0件なら呼び出されない（呼び出し元の責務） | `goldCalculator` が `GOLD_DATA_MISSING` を返す |

---

## 7. 変化球（`tests/unit/domain/breakingCalculator.test.ts`）

対象要件: FR-BR-04 〜 FR-BR-08 / 仕様 `04` §7

| ID | 条件 | 期待 |
|---|---|---|
| UT-BR-01 | `mode="aggregate"` かつ `steps` にもデータあり | 一括値のみ使用。`source="manual"`。ステップを参照しないこと |
| UT-BR-02 | `mode="step"` / step.cost が null / キャッシュ完全一致（slider 1→2, 総変化1, 球種数1, sense_plus） | `{0,0,10,50,0}` / `source="measured"` |
| UT-BR-03 | `mode="step"` / キャッシュ未ヒット（slider 1→2, 総変化**9**, 球種数1） | `BREAKING_DATA_MISSING`。**cost を 0 として計上しないこと** |
| UT-BR-04 | `plan=null` かつ目標構成が空 | `items=[]` / issue なし |
| UT-BR-05 | `plan=null` かつ目標構成が1件以上 | `BREAKING_DATA_MISSING` |
| UT-BR-06 | `playerType="fielder"` | `items=[]` / issue なし |
| UT-BR-07 | `senseMode="normal"` でキャッシュ参照 | `{0,0,20,100,0}`（`breaking_cache_normal.csv` を使用すること） |
| UT-BR-08 | `mode="step"` / step.cost が入力済み（キャッシュにも存在） | 入力値を優先 / `source="manual"` |
| UT-BR-09 | 推定を行わないこと | 近傍キー（総変化2）のデータがあってもヒットさせない |
| UT-BR-10 | 一括値の一部が null | `BREAKING_DATA_MISSING` |

---

## 8. プラン全体（`tests/unit/domain/planCalculator.test.ts`）

対象要件: FR-G-02 〜 FR-G-05, FR-R-01 〜 FR-R-05 / 仕様 `04` §8

| ID | 条件 | 期待 |
|---|---|---|
| UT-PLAN-01 | `archartist` を目標に指定（青特未指定） | `blue` に `power_hitter` が `autoAdded=true` で1件追加される |
| UT-PLAN-02 | 上記に加え `power_hitter` を `currentState="ON"` として所持済み | `power_hitter` の cost が `{0,0,0,0,0}`。金特 cost のみ計上 |
| UT-PLAN-03 | `power_hitter`（コツLv4）と `archartist`（下位コツLv2）を同時指定 / normal | `blue` の `power_hitter` が**1件のみ**。cost = `{72,4,20,0,2}`（コツLv4を採用） |
| UT-PLAN-04 | `clutch_master` を指定し `chance` の現在ランクが D | `chance` が `D→A` として自動追加され `{0,60,105,0,375}`（コツLv0/normal） |
| UT-PLAN-05 | 前提を持たない金特を指定 | 青特は自動追加されない |
| UT-PLAN-06 | 複数の金特が同じ下位青特を要求 | 該当青特は1件のみ計上 |
| UT-PLAN-07 | `total` = `base+blue+gold+breaking` の合計 | 各カテゴリ小計の総和と一致 |
| UT-PLAN-08 | ステータス `confirmed` | 全項目が master/measured/manual のみ |
| UT-PLAN-09 | ステータス `estimated` | 金特推定を1件以上含む |
| UT-PLAN-10 | ステータス `incomplete` | データ不足を1件でも含む（推定も含む場合も `incomplete` が優先） |
| UT-PLAN-11 | 出力順序 | `base` は `display_order` 昇順、`blue` はユーザー指定→自動追加（ID昇順） |
| UT-PLAN-12 | マージ後 `currentState >= targetState` | cost = 0 |
| UT-PLAN-13 | 同じプランを2回計算しても結果が等しい | 計算が純粋関数であること |
| UT-PLAN-14 | 金特の下位青特コツLvと金特コツLvが独立に効く | 下位コツLvのみ変更したとき青特 cost だけが変わる |

---

## 9. CSVパース（`tests/unit/data/csvParser.test.ts`）

| ID | 入力 | 期待 |
|---|---|---|
| UT-CSV-01 | UTF-8 BOM付きCSV | BOMが除去され1列目のヘッダ名が正しく解決される |
| UT-CSV-02 | CRLF 改行 | 正常にパースされる |
| UT-CSV-03 | 空行を含む | 空行が無視される |
| UT-CSV-04 | `#` で始まる行を含む | コメント行が無視される |
| UT-CSV-05 | セル前後に空白を含む | トリムされる |
| UT-CSV-06 | 未知のカラムを含む | 無視され、エラーにならない |
| UT-CSV-07 | カラム順が仕様と異なる | ヘッダ名で解決され正しくパースされる |
| UT-CSV-08 | ダブルクォートでカンマを含む値 | 正しく1セルとして解釈される |
| UT-CSV-09 | snake_case → camelCase 変換 | `from_value` → `fromValue` |

---

## 10. CSV検証（`tests/unit/data/validators.test.ts`）

`tests/fixtures/csv/invalid/` の各ファイルについて、**期待するエラーコードが1件以上返ること**を検証する。

| ID | フィクスチャ | 期待コード | 対応検証ルール |
|---|---|---|---|
| UT-VAL-01 | `base_missing_column.csv` | `INVALID_CSV` | V-02 |
| UT-VAL-02 | `base_non_integer.csv` | `INVALID_CSV` | V-03 |
| UT-VAL-03 | `base_negative.csv` | `INVALID_CSV` | V-04 |
| UT-VAL-04 | `empty_exp_cell.csv` | `INVALID_CSV` | V-05 |
| UT-VAL-05 | `base_gap_transition.csv` | `INVALID_CSV` | V-13 |
| UT-VAL-06 | `base_duplicate_key.csv` | `DUPLICATE_DATA` | V-16 |
| UT-VAL-07 | `blue_rank_skip.csv` | `INVALID_CSV` | V-15 |
| UT-VAL-08 | `blue_invalid_state.csv` | `INVALID_CSV` | V-11 |
| UT-VAL-09 | `blue_conflicting_type.csv` | `INVALID_CSV` | V-17 |
| UT-VAL-09a | `blue_missing_baseline.csv`（Lv1/normal 行のみで基準行なし） | `INVALID_CSV` | V-27 |
| UT-VAL-09b | `blue_duplicate_hint.csv`（同一遷移・同一 `hint_level`/`sense_mode` の重複） | `DUPLICATE_DATA` | V-16 |
| UT-VAL-09c | `blue_invalid_hint_level.csv`（`hint_level=6`） | `INVALID_CSV` | V-09 |
| UT-VAL-09d | `blue_invalid_sense_mode.csv`（`sense_mode=sense`） | `INVALID_CSV` | V-08 |
| UT-VAL-10 | `gold_duplicate_level.csv` | `DUPLICATE_DATA` | V-16 |
| UT-VAL-11 | `gold_estimated_row.csv` | `INVALID_CSV` | V-24 |
| UT-VAL-12 | `prereq_unknown_gold.csv` | `INVALID_CSV` | V-18 |
| UT-VAL-13 | `prereq_unknown_blue.csv` | `INVALID_CSV` | V-19 |
| UT-VAL-14 | `hint_missing_level.csv` | `INVALID_CSV` | V-23 |
| UT-VAL-15 | `config_out_of_range.csv` | `INVALID_CSV` | V-25 |
| UT-VAL-16 | `valid/` 一式 | エラー0件 | 全ルール |
| UT-VAL-17 | 複数エラーを含むCSV | **全件が報告される**（最初の1件で打ち切らない） | — |
| UT-VAL-18 | 201件以上のエラー | 200件まで返し、超過件数が示される | — |
| UT-VAL-19 | エラーに `file` / `line` / `column` が含まれる | 行番号はヘッダを1行目として数える | — |

---

## 11. インデックス・キー生成（`tests/unit/data/keyBuilder.test.ts`）

| ID | 内容 | 期待 |
|---|---|---|
| UT-KEY-01 | `baseKey("pitcher","velocity",130)` | `"pitcher\|velocity\|130"` |
| UT-KEY-02 | `blueKey("chance","fielder","D",0,"normal")` | `"chance\|fielder\|D\|0\|normal"` |
| UT-KEY-03 | `goldKey("archartist","fielder",3,"sense_plus")` | `"archartist\|fielder\|3\|sense_plus"` |
| UT-KEY-04 | `hintKey("gold",3)` | `"gold\|3"` |
| UT-KEY-05 | `breakingKey("slider",2,5,2)` | `"slider\|2\|5\|2"` |
| UT-IDX-01 | `common` 行と `player_type` 一致行が両方ある場合 | 一致行が優先される |
| UT-IDX-02 | `goldByAbility` は `senseMode` 別に分かれる | 異なる senseMode の行が混ざらない |
| UT-IDX-03 | インデックス検索は O(1) | 線形探索を使用していないこと（実装レビュー項目） |

---

## 12. ゲーム切替（`tests/unit/data/gameDataLoader.test.ts`）

| ID | 内容 | 期待 |
|---|---|---|
| UT-GAME-01 | ゲームAをロード後にゲームBへ切替 | ゲームBのCSVのみが参照される。Aのデータが残らない |
| UT-GAME-02 | 必須ファイルが1つ欠ける | `CSV_FILE_MISSING` でロード中止 |
| UT-GAME-03 | 検証エラーがある場合 | インデックスを構築せずロード中止 |
| UT-GAME-04 | 任意ファイル（変化球キャッシュ）が無い | 空データとして正常にロードされる |
| UT-GAME-05 | インポート上書きが種別単位で全置換される | 標準データの同種別行が残らない |
| UT-GAME-06 | 変化球キャッシュのみ追記マージされる | 標準CSVとユーザー登録分の両方が引ける。キー重複時はユーザー登録分が優先 |

---

## 13. エクスポート（`tests/unit/data/exporter.test.ts`）

永続化（IndexedDB）そのものは E2E で検証する。ここでは純粋な整形関数のみを対象とする。

| ID | 内容 | 期待 |
|---|---|---|
| UT-EXP-01 | 計算結果CSVの列構成 | `06_persistence_spec.md` §4.1 と一致 |
| UT-EXP-02 | CSV出力にBOMが付与される | 先頭が `﻿` |
| UT-EXP-03 | プランJSONのラッパ | `format` / `formatVersion` / `exportedAt` / `plan` を含む |
| UT-EXP-04 | ファイル名の禁止文字が置換される | `a/b:c` → `a_b_c` |
| UT-EXP-05 | 小計行・合計行が含まれる | `subtotal` 4行 + `total` 1行 |

---

## 14. カバレッジ要件

| 対象 | 行カバレッジ |
|---|---|
| `src/domain/` | **90%以上（必須）** |
| `src/data/` | 80%以上 |
| `src/store/` | 60%以上 |
| `src/ui/` | 目標値なし（手動UI試験とE2Eで担保） |

`vitest.config.ts` の `coverage.thresholds` に上記を設定し、下回った場合はテスト実行を失敗させること。
