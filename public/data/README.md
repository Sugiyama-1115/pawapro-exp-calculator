# データファイル仕様書（記入ガイド）

本書は `public/data/` に配置する CSV の**記入者向け**ガイドである。
実装が従う正式仕様は [`docs/03_data_spec.md`](../../docs/03_data_spec.md) であり、両者が食い違う場合は `docs/03_data_spec.md` を優先する。

---

## 1. ディレクトリ構成

```text
public/data/
├── games.json                  ゲーム一覧（どのフォルダを読むかの定義）
├── README.md                   本書
├── _template/                  空テンプレート一式（コピー元）
└── <game-id>/                  ゲーム1本ぶんのデータ
    ├── config.csv
    ├── base_ability_defs.csv
    ├── base_normal.csv
    ├── base_sense_plus.csv
    ├── blue_abilities.csv
    ├── gold_abilities.csv
    ├── gold_prerequisites.csv       ← 青特⇔金特 対照表
    ├── hint_rules.csv
    ├── breaking_cache_normal.csv
    └── breaking_cache_sense_plus.csv
```

### 新しいゲームのデータを作る手順

1. `_template/` をコピーして `public/data/<game-id>/` を作る。
   `<game-id>` は英小文字・数字・アンダースコアのみ（例: `pawapro2024`）。
2. `games.json` の `games` 配列に1件追加する。
3. CSV を埋める。
4. アプリを起動し、ゲーム選択で読み込む。検証エラーがあれば全件が一覧表示される。

**コード変更は不要**。能力項目や値域も CSV 側（`base_ability_defs.csv`）で定義する。

---

## 2. 全ファイル共通のルール

| 項目 | 規定 |
|---|---|
| 文字コード | UTF-8（BOM付き／BOM無しどちらでも可） |
| 改行 | LF / CRLF どちらでも可 |
| ヘッダ行 | **1行目に必須**。列の順番は自由（列名で解決する） |
| 数値 | 0以上の整数のみ。小数・マイナス・カンマ区切りは不可。上限 99999 |
| 空欄 | 「対象外」の意味。**0 とは区別される** |
| `0` | 「必要経験点が 0」の意味 |
| 空行 | 無視される |
| `#` で始まる行 | コメントとして無視される |
| セル前後の空白 | 自動でトリムされる |
| ID | 英小文字・数字・アンダースコアのみ（`^[a-z][a-z0-9_]*$`）。日本語名は `display_name` 列に書く |

### 経験点5列

`muscle`（筋力）／ `agility`（敏捷）／ `technique`（技術）／ `breaking`（変化）／ `mental`（精神）。

この5列を持つファイルでは**5列すべてが必須**。空欄はエラーになる。値が無い場合は `0` を書くこと。

### 記録が中断されても壊さない

必須ファイルの必須行さえ揃っていれば、任意行が未記入でもアプリは動く。
データが足りない箇所は計算結果に「データ不足」として表示されるので、**分かる範囲から埋めていけばよい**。

---

## 3. ファイル別の記入方法

### 3.1 `config.csv` — ゲーム単位の設定値

| key | 内容 | 既定値 |
|---|---|---|
| `blue_sense_plus_multiplier` | センス○のとき**青特**に掛ける倍率 | `1.00` |
| `blue_normal_multiplier` | センス○なしのとき青特に掛ける倍率 | `1.00` |
| `gold_estimate_search_max` | 金特推定の探索上限 | `10000` |

- 未記入のキーは既定値が使われる（エラーにならない）。
- **センス倍率は青特にのみ効く。** 金特・基礎能力・変化球には適用されない。
- 丸め方式はここでは指定しない。`hint_rules.csv` の `rounding` 列が唯一の情報源。

---

### 3.2 `base_ability_defs.csv` — 基礎能力の定義

どの能力を、いくつからいくつまで、どの順で画面に出すかを決める。

| 列 | 内容 |
|---|---|
| `ability_id` | 能力ID |
| `display_name` | 画面に出す名前 |
| `player_type` | `pitcher` / `fielder` |
| `min_value` / `max_value` | 入力できる範囲 |
| `display_order` | 画面の並び順（昇順） |
| `value_type` | `numeric`（数値入力）／ `trajectory`（弾道：1〜4の選択式） |

テンプレートには標準的な12項目が入っている。ゲームに合わせて増減してよい。

---

### 3.3 `base_normal.csv` / `base_sense_plus.csv` — 基礎能力の必要経験点

**1段階ぶんずつ**記録する。センス○の有無はファイルを分けて表現する。

```csv
player_type,ability_id,from_value,to_value,muscle,agility,technique,breaking,mental
pitcher,velocity,130,131,10,0,5,0,0
pitcher,velocity,131,132,10,0,5,0,0
fielder,trajectory,1,2,50,0,0,0,20
```

**記入のポイント**

- `to_value` は必ず `from_value + 1`。まとめ書き（130→140 など）は不可。
- 弾道も `1→2`, `2→3`, `3→4` と1段ずつ書く。
- `player_type` に `common` を指定すると投手・野手の両方で使われる。
  同じ能力で `pitcher` 行と `common` 行の両方があれば、`pitcher` 行が優先される。
- 途中の段階が抜けていると、その区間を含む計算が「データ不足」になる。**0で埋めてはいけない**（実際に0経験点なのか、未記録なのか区別できなくなるため）。
- 基礎能力にはコツ倍率もセンス倍率も**適用されない**。センス差は2つのファイルの値の差でそのまま表現する。

**どちらか一方があればよい。** 利用者が選んだセンス状態に対応するファイルが無い場合のみエラーになる。

---

### 3.4 `blue_abilities.csv` — 青特殊能力

**記録したときのコツLvとセンス状態を必ず列に書く。**

```csv
ability_id,display_name,player_type,ability_type,from_state,to_state,hint_level,sense_mode,muscle,agility,technique,breaking,mental
power_hitter,パワーヒッター,fielder,binary,NONE,ON,0,normal,240,15,68,0,8
power_hitter,パワーヒッター,fielder,binary,NONE,ON,1,sense_plus,150,9,42,0,5
chance,チャンス,fielder,rank,G,F,0,normal,0,8,14,0,50
chance,チャンス,fielder,rank,F,E,0,normal,0,10,18,0,62
```

| 列 | 内容 |
|---|---|
| `ability_type` | `binary`（有/無の2値）／ `rank`（G〜Aのランク制） |
| `from_state` / `to_state` | `binary` は `NONE`→`ON` 固定。`rank` は `G`→`F` のように**1段階ずつ** |
| `hint_level` | **記録時のコツLv**（0〜5） |
| `sense_mode` | **記録時のセンス状態**（`normal` / `sense_plus`） |

#### 基準行（必ず必要）

各遷移について、**`hint_level = 0` かつ `sense_mode = normal` の行を1件必ず書く**。これを基準行と呼ぶ。
基準行が無いとロードエラーになる。

#### 基準行以外は書かなくてよい

基準行だけあれば、他のコツLv・センス状態は倍率計算で自動的に求められる。

実際にその条件で測った値がある場合だけ追加すればよい。追加した行は、
プランの（コツLv, センス状態）が**完全に一致したときだけ**そのまま使われる（倍率も丸めも掛からない）。

- 一致しなければ基準行からの計算値が使われる。
- ランク制で複数段階を上げる場合、**区間内の全遷移に一致行が揃っているときだけ**実測値が使われる。1つでも欠けていれば区間全体が計算値になる。

つまり **実測を足せば足すほど精度が上がり、足さなくても壊れない**。

---

### 3.5 `gold_abilities.csv` — 金特殊能力

```csv
ability_id,display_name,player_type,hint_level,sense_mode,muscle,agility,technique,breaking,mental,data_type
archartist,アーチスト,fielder,1,sense_plus,100,10,50,0,20,measured
archartist,アーチスト,fielder,3,sense_plus,60,6,30,0,12,measured
```

#### 記録する値の定義（最重要）

> **ここに書く経験点は「下位能力（下位青特）を習得した後」にゲーム画面へ表示された、金特単体の必要経験点である。**
> **下位青特そのものの取得費は含めない。**

金特と下位青特の紐づけは `gold_prerequisites.csv`（青特⇔金特 対照表）だけで行う。
アプリは対照表を引いて下位青特を必要能力へ自動追加し、その取得費を**別項目として**計上する。

```text
合計 = 金特の必要経験点（下位習得後の値） + 下位青特の取得費
       └ gold_abilities.csv          └ blue_abilities.csv × 対照表
```

したがって、金特の行に下位青特の費用を足し込んで記録すると**二重計上**になる。

#### その他の記入ルール

- `data_type` は `measured`（実測）のみ。推定値をこのファイルに書いてはいけない。推定はアプリが行う。
- `hint_level` / `sense_mode` は**測ったときの条件**をそのまま書く。
- **全部のコツLvを埋める必要はない。** 1件でもあれば他のLvは推定される。2件以上あると「高信頼推定」になる。
- センス状態が違う行から推定することはない。使いたいセンス状態ごとに最低1件必要。

---

### 3.6 `gold_prerequisites.csv` — 青特⇔金特 対照表

金特と、その下位能力である青特の対応関係を書く。**`gold_abilities.csv` の値が「下位習得後の値」であることの前提を成立させるファイル。**

```csv
gold_id,lower_blue_id,required_state
archartist,power_hitter,ON
clutch_master,chance,A
```

| 列 | 内容 |
|---|---|
| `gold_id` | 金特ID（`gold_abilities.csv` に存在すること） |
| `lower_blue_id` | 下位青特ID（`blue_abilities.csv` に存在すること） |
| `required_state` | 必要な状態。`binary` の青特なら `ON`、`rank` の青特なら `G`〜`A` |

**記入のポイント**

- 下位青特が複数ある金特は、同じ `gold_id` で**複数行**に分けて書く。すべてが必要能力に加算される。
- 下位能力を持たない金特は**行を書かない**（それが正常な状態）。
- `lower_blue_id` に金特を指定してはいけない。下位に指定できるのは青特のみ。
- 存在しないIDを書くとロードエラーになる。

記入例つきのテンプレートが `_template/gold_prerequisites.csv` にある。

---

### 3.7 `hint_rules.csv` — コツLv倍率

```csv
ability_type,hint_level,multiplier,rounding
blue,0,1.00,floor
...
gold,5,0.20,floor
```

- `blue` と `gold` それぞれについて **Lv0〜Lv5 の6行、計12行すべてが必須**。
- `rounding` は `floor`（切り捨て）／ `round`（四捨五入）／ `ceil`（切り上げ）。
- 倍率をコード側に持たせることは禁止されている。値の調整はこのファイルで行う。

テンプレートには一般的に使われる倍率が入っている。ゲームの実測に合わせて調整すること。

---

### 3.8 `breaking_cache_normal.csv` / `breaking_cache_sense_plus.csv` — 変化球キャッシュ（任意）

変化球の1段階ぶんの必要経験点を、**取得直前の状況込み**で記録する。

```csv
pitch_type,from_level,to_level,total_break_before,pitch_count_before,muscle,agility,technique,breaking,mental
slider,1,2,1,1,0,0,10,50,0
curve,0,1,3,1,0,0,25,110,0
```

| 列 | 内容 |
|---|---|
| `pitch_type` | 球種ID（自由な文字列ID。`slider`, `curve`, `fork` など） |
| `from_level` / `to_level` | 変化量。新規取得は `0`→`1`。`to_level` は必ず `from_level + 1` |
| `total_break_before` | 取得**直前**の総変化量 |
| `pitch_count_before` | 取得**直前**に持っている変化球の系統数（ストレートは数えない） |

**記入のポイント**

- 変化球の経験点は「そのときの総変化量・球種数」で変わるため、この4項目がキーになる。
- 再利用されるのは **4項目が完全一致したときだけ**。近い値からの補間・推定は行わない。
- センス状態はファイル名で区別するので、列は持たない。
- **このファイルは任意。** 無くてもエラーにならず、その場合は毎回手入力になる。アプリ上で入力した値は自動でここに蓄積される想定。

---

## 4. 記入前に決めておくこと

| 決めること | 影響するファイル |
|---|---|
| センス○ありで測るか、なしで測るか | `base_*.csv`, `breaking_cache_*.csv`（ファイル分け）／ `blue_abilities.csv`, `gold_abilities.csv`（`sense_mode` 列） |
| コツLvいくつで測ったか | `blue_abilities.csv`, `gold_abilities.csv`（`hint_level` 列） |
| 金特を測るとき下位青特を取得済みか | `gold_abilities.csv`（**必ず取得後に測る**） |

**測定条件を記録に残さないデータは使えない。** 迷ったら「センス○なし・コツLv0」で測って基準行にするのが最も潰しが効く。

---

## 5. よくある間違い

| 間違い | どうなるか | 正しい書き方 |
|---|---|---|
| 未記録の段階を `0` で埋める | 「経験点0で上がる」と解釈され、合計が過少になる | 行ごと書かない |
| 基礎能力を `130→140` とまとめて書く | ロードエラー（`to_value = from_value + 1` 違反） | 1段階ずつ10行に分ける |
| 青特のランクを `D→A` と書く | ロードエラー（1段階ずつ違反） | `D→C`, `C→B`, `B→A` の3行に分ける |
| 青特に基準行（Lv0/normal）が無い | ロードエラー | 各遷移に必ず1件書く |
| 金特に下位青特の費用を足して記録 | 二重計上で合計が過大になる | 金特単体の値だけ書き、紐づけは対照表で行う |
| 金特を下位青特未取得のまま測る | 実際と異なる値になる（検出不能） | 必ず下位青特を取得してから測る |
| `data_type` に `estimated` と書く | ロードエラー | 推定はアプリが行う。実測のみ記録する |
| 日本語IDを使う | ロードエラー（ID書式違反） | IDは英小文字。日本語は `display_name` へ |

---

## 6. 検証エラーの読み方

読み込み時に全件検査が走り、**1件でも違反があれば読み込みは中止される**。
エラーは最初の1件で打ち切らず、全件（最大200件）が次の形式で表示される。

```text
blue_abilities.csv 15行目: 列 technique の値 "-5" は 0 以上の整数ではありません。 [INVALID_CSV]
gold_prerequisites.csv 4行目: lower_blue_id "power_hittor" が blue_abilities.csv に存在しません。 [INVALID_CSV]
```

行番号は**ヘッダを1行目**として数える。

| エラーコード | 意味 |
|---|---|
| `CSV_FILE_MISSING` | 必須ファイルが無い |
| `INVALID_CSV` | 列・値・参照先が仕様に反する |
| `DUPLICATE_DATA` | 一意キーが重複している |

検証ルールの全一覧は [`docs/03_data_spec.md`](../../docs/03_data_spec.md) §11 を参照。

---

## 7. サンプルデータについて

`sample2024/` は**ダミー値**であり実際のゲームの値ではない。動作確認と書式の参照用。
アプリ上では常に「サンプルデータ（実際の値ではありません）」と表示される。

実測データを入れたフォルダは `.gitignore` により Git 管理外になる（`sample2024/` と `_template/` を除く）。
