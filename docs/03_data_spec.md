# 03. CSVデータ仕様

---

## 1. 共通仕様

| 項目 | 規定 |
|---|---|
| 文字コード | UTF-8。**BOM付き / BOM無し の両方を受理する**（読込時にBOMを除去する）。 |
| 改行 | LF / CRLF の両方を受理する。 |
| 区切り文字 | 半角カンマ `,` |
| 引用符 | ダブルクォート `"`。値にカンマを含む場合は必須。 |
| ヘッダ行 | 必須。1行目にカラム名を記載する。 |
| カラム順 | **任意**。ヘッダ名で解決する。ただし出力時は本書の記載順とする。 |
| 未知カラム | 無視する（エラーにしない）。 |
| 空行 | 無視する。 |
| 先頭が `#` の行 | コメントとして無視する。 |
| 前後空白 | 各セルの前後空白はトリムする。 |
| 数値 | 0以上の整数。小数・負値・カンマ区切りは不可。上限 99999。 |
| 空欄 | 「値が存在しない / 対象外」を意味する。**0 と明確に区別する**。 |
| `0` | 「必要経験点が 0」を意味する。 |
| ID | 英小文字・数字・アンダースコアのみ（`^[a-z][a-z0-9_]*$`）。日本語名は `display_name` に持つ。 |

### 経験点カラム（全ファイル共通）

`muscle`, `agility`, `technique`, `breaking`, `mental` の5カラム。この5つを持つファイルでは**5カラムすべてが必須**であり、空欄は 0 として扱わずエラーとする。

---

## 2. ファイル一覧

`public/data/<directory>/` 配下に配置する。

| ファイル | 必須 | 内容 |
|---|---|---|
| `config.csv` | 必須 | ゲーム単位の設定値 |
| `base_ability_defs.csv` | 必須 | 基礎能力の定義（項目・範囲・表示順） |
| `base_sense_plus.csv` | 条件付き必須 | 基礎能力の必要経験点（センス○あり） |
| `base_normal.csv` | 条件付き必須 | 基礎能力の必要経験点（センス○なし） |
| `blue_abilities.csv` | 必須 | 青特殊能力マスタ |
| `gold_abilities.csv` | 必須 | 金特殊能力の実測値 |
| `gold_prerequisites.csv` | 必須 | 金特の下位青特定義 |
| `hint_rules.csv` | 必須 | コツLv倍率 |
| `breaking_cache_sense_plus.csv` | 任意 | 変化球ステップ実測の共通キャッシュ（センス○あり） |
| `breaking_cache_normal.csv` | 任意 | 変化球ステップ実測の共通キャッシュ（センス○なし） |

「条件付き必須」: 少なくとも一方が存在すること。利用者が選択した `sense_mode` に対応するファイルが無い場合はロードエラーとする。
「任意」: ファイルが存在しない場合は空データとして扱う（エラーにしない）。

> **v1.0原仕様からの追加**: `base_ability_defs.csv` は本仕様で追加した。基礎能力の項目・値域をコードに固定せずデータ側で定義するため（完了条件19「新作をコード変更なしで追加」を満たす要）。

---

## 3. `config.csv`

```csv
key,value
blue_sense_plus_multiplier,0.90
blue_normal_multiplier,1.00
gold_estimate_search_max,10000
```

| カラム | 型 | 内容 |
|---|---|---|
| `key` | string | 設定キー |
| `value` | string | 設定値 |

### 設定キー定義

| key | 型 | 既定値 | 内容 |
|---|---|---|---|
| `blue_sense_plus_multiplier` | 小数 0.01〜1.00 | `1.00` | sense_mode = `sense_plus` のときに**青特**の必要経験点へ掛ける倍率 |
| `blue_normal_multiplier` | 小数 0.01〜1.00 | `1.00` | sense_mode = `normal` のときに**青特**へ掛ける倍率 |
| `gold_estimate_search_max` | 整数 1〜100000 | `10000` | 仮想基礎値Bの探索上限 |

**丸め方式は `config.csv` では定義しない。** 特殊能力の丸め方式は `hint_rules.csv` の `rounding` 列を唯一の情報源とする（`04_calculation_spec.md` §4 参照）。センス倍率は**青特にのみ**適用する。金特は `gold_abilities.csv` の実測値そのものが sense_mode 込みの値であるため、センス倍率を重ねて適用してはならない。

> **v1.0原仕様からの変更**: 原仕様 §14 では `special_sense_plus_multiplier` / `special_sense_plus_rounding` を定義していたが、`hint_rules.csv` の `rounding` と丸め位置が二重定義になり計算結果が実装依存になるため、丸め方式を `hint_rules.csv` へ一本化し、キー名を用途が明確な `blue_*` に改めた。

- **`config.csv` に未定義のキーがあれば既定値を使用する**（エラーにしない）。
- 定義済みキー以外の行は無視する。
- 値が型・範囲に反する場合は `INVALID_CSV` とする。

---

## 4. `base_ability_defs.csv`

基礎能力の項目・値域・表示順を定義する。

```csv
ability_id,display_name,player_type,min_value,max_value,display_order,value_type
trajectory,弾道,fielder,1,4,10,trajectory
contact,ミート,fielder,1,100,20,numeric
power,パワー,fielder,1,100,30,numeric
speed,走力,fielder,1,100,40,numeric
arm,肩力,fielder,1,100,50,numeric
fielding,守備力,fielder,1,100,60,numeric
catching,捕球,fielder,1,100,70,numeric
velocity,球速,pitcher,100,170,10,numeric
control,コントロール,pitcher,1,100,20,numeric
stamina,スタミナ,pitcher,1,100,30,numeric
fielding,守備力,pitcher,1,100,40,numeric
catching,捕球,pitcher,1,100,50,numeric
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `ability_id` | ○ | ID | 能力ID |
| `display_name` | ○ | string | 表示名 |
| `player_type` | ○ | `pitcher` / `fielder` | 対象選手種別 |
| `min_value` | ○ | 整数 | 入力可能な最小値 |
| `max_value` | ○ | 整数 | 入力可能な最大値。`min_value` 未満は不可。 |
| `display_order` | ○ | 整数 | 画面上の並び順（昇順） |
| `value_type` | ○ | `numeric` / `trajectory` | 入力UIの種別。`trajectory` は 1〜4 の選択式。 |

一意キー: `(player_type, ability_id)`。重複は `DUPLICATE_DATA`。

投手プランで野手能力も入力する場合（FR-B-07）は、`player_type = fielder` の定義を折りたたみ領域に表示し、
経験点は `base_*.csv` の `player_type = fielder` 行または `common` 行から取得する。

---

## 5. `base_sense_plus.csv` / `base_normal.csv`

基礎能力を1段階上げるのに必要な経験点。**2ファイルはカラム構成が同一**。

```csv
player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental
pitcher,velocity,130,131,10,0,5,0,0
pitcher,velocity,131,132,10,0,5,0,0
pitcher,control,40,41,0,0,4,0,3
fielder,contact,40,41,1,0,5,0,7
fielder,trajectory,1,2,50,0,0,0,20
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `player_type` | ○ | `pitcher` / `fielder` / `common` | `common` は両種別で使用可 |
| `ability_id` | ○ | ID | `base_ability_defs.csv` に存在すること |
| `from_value` | ○ | 整数 | 上昇前の値 |
| `to_value` | ○ | 整数 | 上昇後の値。**必ず `from_value + 1`** |
| `muscle` 〜 `mental` | ○ | 整数 | 必要経験点 |

### 制約

- `to_value = from_value + 1` を必須とする。差が1でない行は `INVALID_CSV`。
  - 弾道も 1→2, 2→3, 3→4 と1段階ずつ記録する。
- 一意キー: `(player_type, ability_id, from_value)`。重複は `DUPLICATE_DATA`。
- `from_value` / `to_value` は `base_ability_defs.csv` の `[min_value, max_value]` の範囲内であること。
- 値の解決順序: `player_type` 完全一致行 → `common` 行。両方あれば完全一致行を優先する。

---

## 6. `blue_abilities.csv`

```csv
ability_id,display_name,player_type,ability_type,from_state,to_state,muscle,agility,technique,breaking,mental
power_hitter,パワーヒッター,fielder,binary,NONE,ON,240,15,68,0,8
average_hitter,アベレージヒッター,fielder,binary,NONE,ON,23,38,195,0,83
chance,チャンス,fielder,rank,G,F,0,8,14,0,50
chance,チャンス,fielder,rank,F,E,0,10,18,0,62
chance,チャンス,fielder,rank,E,D,0,13,22,0,80
chance,チャンス,fielder,rank,D,C,0,16,28,0,100
chance,チャンス,fielder,rank,C,B,0,20,35,0,125
chance,チャンス,fielder,rank,B,A,0,24,42,0,150
strikeout,奪三振,pitcher,binary,NONE,ON,35,0,80,50,35
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `ability_id` | ○ | ID | 能力ID |
| `display_name` | ○ | string | 表示名。同一 `ability_id` の全行で一致すること |
| `player_type` | ○ | `pitcher` / `fielder` / `common` | 対象選手種別 |
| `ability_type` | ○ | `binary` / `rank` | 能力種別。同一 `ability_id` の全行で一致すること |
| `from_state` | ○ | 状態値 | 遷移前 |
| `to_state` | ○ | 状態値 | 遷移後 |
| `muscle` 〜 `mental` | ○ | 整数 | **コツLv0・センス補正なし** の必要経験点 |

### 状態値

| ability_type | 使用可能な状態値 | 順序 |
|---|---|---|
| `binary` | `NONE`, `ON` | `NONE` < `ON` |
| `rank` | `G`, `F`, `E`, `D`, `C`, `B`, `A` | `G` < `F` < `E` < `D` < `C` < `B` < `A` |

**この順序定義はアプリ内に固定で持つ。** ゲーム側の仕様変更でランク段数が変わった場合は本仕様の改訂を要する。

### 制約

- `binary` 型の行は `from_state = NONE`, `to_state = ON` のみ許可。
- `rank` 型の行は **1段階ずつ**（`G→F`, `F→E`, …）のみ許可。2段階以上飛ぶ行は `INVALID_CSV`。
- 一意キー: `(ability_id, player_type, from_state)`。重複は `DUPLICATE_DATA`。
- `rank` 型で途中の遷移行が欠けている場合、その区間を含む計算時に `BLUE_DATA_MISSING` とする（ロード時エラーにはしない）。

---

## 7. `gold_abilities.csv`

金特の**実測値**を記録する。

```csv
ability_id,display_name,player_type,hint_level,sense_mode,muscle,agility,technique,breaking,mental,data_type
archartist,アーチスト,fielder,1,sense_plus,100,10,50,0,20,measured
archartist,アーチスト,fielder,3,sense_plus,60,6,30,0,12,measured
doctor_k,ドクターK,pitcher,1,sense_plus,50,0,100,70,40,measured
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `ability_id` | ○ | ID | 金特ID |
| `display_name` | ○ | string | 表示名。同一 `ability_id` の全行で一致すること |
| `player_type` | ○ | `pitcher` / `fielder` / `common` | 対象選手種別 |
| `hint_level` | ○ | 整数 0〜5 | 実測時のコツLv |
| `sense_mode` | ○ | `normal` / `sense_plus` | 実測時のセンス状態 |
| `muscle` 〜 `mental` | ○ | 整数 | 実測した必要経験点 |
| `data_type` | ○ | `measured` | **`measured` のみ許可**。`estimated` 行が存在したら `INVALID_CSV`。 |

### 制約

- 一意キー: `(ability_id, player_type, hint_level, sense_mode)`。重複は `DUPLICATE_DATA`（原仕様 §24）。
- ここに記録する値は「**下位青特を取得済みの状態でゲーム画面に表示された金特単体の必要経験点**」である（原仕様 §15）。下位青特の取得費は含まない。
- `sense_mode` はプランの `sense_mode` と一致する行のみ使用する。異なる `sense_mode` の行から推定してはならない。

---

## 8. `gold_prerequisites.csv`

```csv
gold_id,lower_blue_id,required_state
archartist,power_hitter,ON
artist_hit,average_hitter,ON
clutch_master,chance,A
doctor_k,strikeout,ON
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `gold_id` | ○ | ID | 金特ID。`gold_abilities.csv` に存在すること |
| `lower_blue_id` | ○ | ID | 下位青特ID。`blue_abilities.csv` に存在すること |
| `required_state` | ○ | 状態値 | 金特取得に必要な下位青特の状態（`ON` またはランク） |

### 制約

- 一意キー: `(gold_id, lower_blue_id)`。重複は `DUPLICATE_DATA`。
- 1つの金特に複数の前提青特を定義してよい（複数行）。その場合はすべてを必要能力へ追加する。
- 前提を持たない金特は本ファイルに行を持たない（それが正常）。
- `required_state` は `lower_blue_id` の `ability_type` に対応する状態値であること。
  - `binary` なら `ON` のみ。`rank` なら `G`〜`A`。
- 参照先が存在しない場合は `INVALID_CSV`（ロード時に検出）。
- **循環参照は禁止**（金特の前提に金特を指定することは不可。`lower_blue_id` は青特のみ）。

---

## 9. `hint_rules.csv`

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

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `ability_type` | ○ | `blue` / `gold` | 適用対象 |
| `hint_level` | ○ | 整数 0〜5 | コツLv |
| `multiplier` | ○ | 小数 0.01〜1.00 | 倍率 |
| `rounding` | ○ | `floor` / `round` / `ceil` | 丸め方式 |

### 制約

- 一意キー: `(ability_type, hint_level)`。重複は `DUPLICATE_DATA`。
- `blue` と `gold` それぞれについて **Lv0〜Lv5 の6行すべてが必須**。欠落は `INVALID_CSV`。
- 倍率はコードにハードコードしてはならない。

---

## 10. `breaking_cache_sense_plus.csv` / `breaking_cache_normal.csv`

変化球ステップ実測の共通キャッシュ。**2ファイルはカラム構成が同一**。

```csv
pitch_type,from_level,to_level,total_break_before,pitch_count_before,muscle,agility,technique,breaking,mental
slider,1,2,1,1,0,0,10,50,0
slider,2,3,2,1,0,0,12,60,0
curve,0,1,3,1,0,0,25,110,0
```

| カラム | 必須 | 型 | 内容 |
|---|---|---|---|
| `pitch_type` | ○ | ID | 球種ID |
| `from_level` | ○ | 整数 0〜7 | 上昇前の変化量。新規取得時は 0 |
| `to_level` | ○ | 整数 1〜7 | 上昇後の変化量。**必ず `from_level + 1`** |
| `total_break_before` | ○ | 整数 0〜99 | 取得直前の**総変化量** |
| `pitch_count_before` | ○ | 整数 0〜10 | 取得直前に所持している**変化球系統数**。ストレートは含めない |
| `muscle` 〜 `mental` | ○ | 整数 | 必要経験点 |

### 制約

- 一意キー: `(pitch_type, from_level, total_break_before, pitch_count_before)`。重複は `DUPLICATE_DATA`。
- `sense_mode` はファイル名で区別するためカラムを持たない。
- 再利用は**キー完全一致時のみ**。近似・補間・推定は禁止（原仕様 §32）。

### 球種ID（推奨値・拡張可）

`slider`, `curve`, `fork`, `sinker`, `shoot`, `hi_fastball`, `chenge_up`, `screw`, `cutter`, `knuckle`, `special`

球種IDは本アプリでは自由な文字列IDとして扱い、コード内に固定リストを持たない。UIの候補一覧はキャッシュCSVに出現する `pitch_type` と、利用者が入力した値から生成する。

---

## 11. CSVロード時検証ルール一覧

ゲーム選択時・CSVインポート時に以下を全件検査する。**1件でも違反があればロードを中止する**（原仕様 §43）。

| No | 検証項目 | 違反時エラーコード |
|---|---|---|
| V-01 | 必須ファイルが存在する | `CSV_FILE_MISSING` |
| V-02 | 必須カラムがすべて存在する | `INVALID_CSV` |
| V-03 | 数値カラムが整数として解釈できる | `INVALID_CSV` |
| V-04 | 数値カラムが 0 以上 99999 以下 | `INVALID_CSV` |
| V-05 | 経験点5カラムに空欄がない | `INVALID_CSV` |
| V-06 | ID が `^[a-z][a-z0-9_]*$` に一致する | `INVALID_CSV` |
| V-07 | `player_type` が `pitcher` / `fielder` / `common` のいずれか | `INVALID_CSV` |
| V-08 | `sense_mode` が `normal` / `sense_plus` のいずれか | `INVALID_CSV` |
| V-09 | `hint_level` が 0〜5 | `INVALID_CSV` |
| V-10 | `ability_type` が `binary` / `rank` のいずれか | `INVALID_CSV` |
| V-11 | 状態値が `ability_type` に対応する集合に含まれる | `INVALID_CSV` |
| V-12 | `rounding` が `floor` / `round` / `ceil` のいずれか | `INVALID_CSV` |
| V-13 | 基礎能力の `to_value = from_value + 1` | `INVALID_CSV` |
| V-14 | 変化球の `to_level = from_level + 1` | `INVALID_CSV` |
| V-15 | ランク青特の遷移が1段階のみ | `INVALID_CSV` |
| V-16 | 各ファイルの一意キーが重複していない | `DUPLICATE_DATA` |
| V-17 | 同一 `ability_id` で `display_name` / `ability_type` / `player_type` が矛盾しない | `INVALID_CSV` |
| V-18 | `gold_prerequisites.gold_id` が `gold_abilities` に存在する | `INVALID_CSV` |
| V-19 | `gold_prerequisites.lower_blue_id` が `blue_abilities` に存在する | `INVALID_CSV` |
| V-20 | `gold_prerequisites.required_state` が参照先の状態集合に含まれる | `INVALID_CSV` |
| V-21 | `base_*.csv` の `ability_id` が `base_ability_defs` に存在する | `INVALID_CSV` |
| V-22 | `base_*.csv` の値が `base_ability_defs` の min/max 範囲内 | `INVALID_CSV` |
| V-23 | `hint_rules` に blue/gold × Lv0〜5 の12行が揃っている | `INVALID_CSV` |
| V-24 | `gold_abilities.data_type` がすべて `measured` | `INVALID_CSV` |
| V-25 | `config.csv` の値が型・範囲に適合する | `INVALID_CSV` |
| V-26 | `base_ability_defs` の `max_value >= min_value` | `INVALID_CSV` |

### エラー報告形式

検証エラーは以下の構造で収集し、**最初の1件で打ち切らず全件を報告する**（最大200件、超過分は件数のみ表示）。

```ts
interface ValidationIssue {
  code: string;        // 上表のエラーコード
  file: string;        // 例: "blue_abilities.csv"
  line: number | null; // CSVの行番号（ヘッダを1行目とする）。ファイル単位の問題は null
  column: string | null;
  message: string;     // 日本語のメッセージ
}
```

表示例:

```text
blue_abilities.csv 15行目: 列 technique の値 "-5" は 0 以上の整数ではありません。 [INVALID_CSV]
gold_prerequisites.csv 4行目: lower_blue_id "power_hittor" が blue_abilities.csv に存在しません。 [INVALID_CSV]
```

---

## 12. サンプルデータの扱い

- `public/data/sample2024/` は**ダミー値**であり、実際のゲームの値ではない。画面上に「サンプルデータ（実際の値ではありません）」と常時表示する。
- サンプルデータは全検証ルールを通過し、かつ以下を含むこと。
  - 投手・野手の基礎能力を各1能力以上（連続する遷移を5段階以上）
  - `binary` 青特と `rank` 青特を各1件以上
  - 前提を持つ金特と持たない金特を各1件以上
  - 実測Lvが1件のみの金特（推定テスト用）と2件以上の金特（高信頼推定テスト用）
  - 変化球キャッシュを3行以上
- `public/data/pawapro2024/` 以下の実測データは `.gitignore` により Git 管理外とする。

`.gitignore` に以下を記載する。

```gitignore
public/data/*/
!public/data/sample2024/
```
