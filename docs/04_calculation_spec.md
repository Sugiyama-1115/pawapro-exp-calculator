# 04. 計算エンジン仕様

本章の記述は**実装の自由度を認めない確定仕様**である。関数名・シグネチャ・アルゴリズム・境界条件をそのまま実装すること。

---

## 1. 型定義

`src/domain/models/` に以下を定義する。

```ts
// expVector.ts
export interface ExpVector {
  muscle: number;
  agility: number;
  technique: number;
  breaking: number;
  mental: number;
}

export const EXP_KEYS = ["muscle", "agility", "technique", "breaking", "mental"] as const;
export type ExpKey = (typeof EXP_KEYS)[number];

export function zeroVector(): ExpVector;
export function addVector(a: ExpVector, b: ExpVector): ExpVector;
export function sumVectors(list: ExpVector[]): ExpVector;
export function isZeroVector(v: ExpVector): boolean;
export function totalOf(v: ExpVector): number; // 5要素の単純合計
```

```ts
// ability.ts
export type PlayerType = "pitcher" | "fielder" | "common";
export type SenseMode = "normal" | "sense_plus";
export type AbilityType = "binary" | "rank";

export const BINARY_STATES = ["NONE", "ON"] as const;
export const RANK_STATES = ["G", "F", "E", "D", "C", "B", "A"] as const;

export interface BaseAbilityDef {
  abilityId: string;
  displayName: string;
  playerType: Exclude<PlayerType, "common">;
  minValue: number;
  maxValue: number;
  displayOrder: number;
  valueType: "numeric" | "trajectory";
}

export interface BaseCostRow {
  playerType: PlayerType;
  abilityId: string;
  fromValue: number;
  toValue: number;
  cost: ExpVector;
}

export interface BlueAbilityRow {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  abilityType: AbilityType;
  fromState: string;
  toState: string;
  hintLevel: number;      // 記録時のコツLv
  senseMode: SenseMode;   // 記録時のセンス状態
  cost: ExpVector;        // 当該 hintLevel / senseMode における実測値
}

export interface GoldAbilityRow {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;
  hintLevel: number;
  senseMode: SenseMode;
  cost: ExpVector; // 実測値
}

export interface BlueAbilityMeta {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;   // この ability_id 自身がマスタ上で持つ選手種別（プランの playerType とは独立）
  abilityType: AbilityType;
  states: string[];         // 基準行から構築した状態遷移列（例: ["NONE","ON"] や ["G",...,"A"]）
}

export interface GoldAbilityMeta {
  abilityId: string;
  displayName: string;
  playerType: PlayerType;   // この ability_id 自身がマスタ上で持つ選手種別
}

export interface GoldPrerequisite {
  goldId: string;
  lowerBlueId: string;
  requiredState: string;
}

export interface HintRule {
  abilityType: "blue" | "gold";
  hintLevel: number;
  multiplier: number;
  rounding: RoundingMode;
}

export interface BreakingCacheRow {
  pitchType: string;
  fromLevel: number;
  toLevel: number;
  totalBreakBefore: number;
  pitchCountBefore: number;
  cost: ExpVector;
}

export type RoundingMode = "floor" | "round" | "ceil";
```

```ts
// gameData.ts
export interface GameConfig {
  blueSensePlusMultiplier: number;
  blueNormalMultiplier: number;
  goldEstimateSearchMax: number;
}

export interface GameDataSet {
  gameId: string;
  config: GameConfig;

  baseDefs: Map<string, BaseAbilityDef>;          // key: `${playerType}|${abilityId}`
  baseDefList: BaseAbilityDef[];                  // displayOrder 昇順

  baseSensePlus: Map<string, BaseCostRow>;        // key: baseKey()
  baseNormal: Map<string, BaseCostRow>;

  blue: Map<string, BlueAbilityRow>;              // key: blueKey()
  blueIndex: Map<string, BlueAbilityMeta>;        // key: abilityId（表示名・型・遷移一覧）
                                                  // 遷移一覧は基準行（Lv0/normal）から構築する

  gold: Map<string, GoldAbilityRow>;              // key: goldKey()
  goldByAbility: Map<string, GoldAbilityRow[]>;   // key: `${abilityId}|${senseMode}`
  goldIndex: Map<string, GoldAbilityMeta>;        // key: abilityId

  goldPrereq: Map<string, GoldPrerequisite[]>;    // key: goldId

  hintRules: Map<string, HintRule>;               // key: `${abilityType}|${hintLevel}`

  breakingSensePlus: Map<string, BreakingCacheRow>; // key: breakingKey()
  breakingNormal: Map<string, BreakingCacheRow>;
}
```

```ts
// plan.ts
export interface PlayerPlan {
  id: string;              // UUID v4
  name: string;
  gameId: string;
  playerType: "pitcher" | "fielder";
  senseMode: SenseMode;

  currentBase: Record<string, number>;   // abilityId -> 値
  targetBase: Record<string, number>;

  blueTargets: BlueTarget[];
  goldTargets: GoldTarget[];

  breakingPlan: BreakingPlan | null;

  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
}

export interface BlueTarget {
  abilityId: string;
  currentState: string;   // "NONE" | "ON" | "G".."A"
  targetState: string;
  hintLevel: number;      // 0-5
}

export interface GoldTarget {
  abilityId: string;
  hintLevel: number;              // 0-5（金特本体のコツLv）
  lowerAbilityHintLevel: number;  // 0-5（自動追加される下位青特のコツLv）
}

export interface BreakingPlan {
  composition: BreakingComposition[];  // 目標構成（表示用）
  mode: "aggregate" | "step" | "none";
  aggregate: ExpVector | null;         // mode = "aggregate" のとき使用
  steps: BreakingStep[];               // mode = "step" のとき使用
}

export interface BreakingComposition {
  pitchType: string;
  level: number;  // 目標変化量
}

export interface BreakingStep {
  seq: number;
  pitchType: string;
  fromLevel: number;
  toLevel: number;
  totalBreakBefore: number;
  pitchCountBefore: number;
  cost: ExpVector | null;   // null = 未入力（キャッシュ解決対象）
}
```

```ts
// result.ts
export type ItemCategory = "base" | "blue" | "gold" | "breaking";
export type ItemSource = "master" | "measured" | "estimated" | "estimated_high" | "manual";
export type ResultStatus = "confirmed" | "estimated" | "incomplete";

export interface CalculationItem {
  category: ItemCategory;
  id: string;
  displayName: string;
  detail: string;            // 例: "130 → 155", "D → A", "Lv3"
  cost: ExpVector;
  source: ItemSource;
  autoAdded: boolean;        // 金特前提により自動追加された青特なら true
}

export interface CalculationIssue {
  code: string;              // 07章のエラーコード
  category: ItemCategory | "load";
  targetId: string;
  message: string;           // 日本語
}

export interface CalculationResult {
  total: ExpVector;
  subtotal: Record<ItemCategory, ExpVector>;
  base: CalculationItem[];
  blue: CalculationItem[];
  gold: CalculationItem[];
  breaking: CalculationItem[];
  status: ResultStatus;
  issues: CalculationIssue[];
}
```

---

## 2. 丸め（`domain/rounding.ts`）

```ts
export function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case "floor": return Math.floor(value);
    case "ceil":  return Math.ceil(value);
    case "round": return Math.floor(value + 0.5); // 0.5 は常に切り上げ
  }
}
```

- `round` は JavaScript の `Math.round` と同じく **0.5 を切り上げ**とする（負値は扱わないため差異は生じない）。
- 浮動小数点誤差対策として、丸める前に `value = Number(value.toFixed(6))` で正規化してから `applyRounding` を適用する。
  - 例: `240 × 0.7 = 168.00000000000003` → `168.000000` → `floor` → `168`
- **丸めは5カテゴリそれぞれ独立して行う**（原仕様 §13）。ベクトル全体の合計に対して丸めてはならない。

---

## 3. 基礎能力の計算（`baseCalculator.ts`）

```ts
export function calculateBaseAbility(
  gameData: GameDataSet,
  playerType: "pitcher" | "fielder",
  senseMode: SenseMode,
  abilityId: string,
  currentValue: number,
  targetValue: number
): { cost: ExpVector; issues: CalculationIssue[] };
```

### アルゴリズム

```text
1. targetValue < currentValue          → INVALID_TARGET を返し cost = 0
2. targetValue === currentValue        → cost = 0（issue なし）
3. senseMode に応じ使用テーブルを決定
     sense_plus → gameData.baseSensePlus
     normal     → gameData.baseNormal
4. total = zeroVector()
   for (v = currentValue; v < targetValue; v++) {
       row = table.get(baseKey(playerType, abilityId, v))
          ?? table.get(baseKey("common",  abilityId, v))
       if (!row) → BASE_DATA_MISSING を issue に追加し、その1段階を 0 とせず打ち切る
       total = addVector(total, row.cost)
   }
5. return { cost: total, issues }
```

### 重要な規定

- 該当行が1つでも欠けた場合、**その能力全体を「データ不足」として扱う**。欠けた段階を 0 で補完してはならない。
  - `issues` に `BASE_DATA_MISSING` を1件追加し、`cost` は**そこまでの積み上げ値を返す**が、結果ステータスは `incomplete` になる。
- 基礎能力にセンス倍率・コツ倍率を**適用しない**。センス差は CSV ファイルの差で表現する。
- `currentValue` / `targetValue` が `base_ability_defs` の `[minValue, maxValue]` 範囲外の場合は `INVALID_TARGET`。

### 計算例

`base_sense_plus.csv` に以下がある場合。

| ability | from | to | muscle | agility | technique | breaking | mental |
|---|---|---|---|---|---|---|---|
| velocity | 130 | 131 | 10 | 0 | 5 | 0 | 0 |
| velocity | 131 | 132 | 10 | 0 | 5 | 0 | 0 |
| velocity | 132 | 133 | 12 | 0 | 6 | 0 | 0 |

`current = 130, target = 133` → 3行を加算 → `{muscle: 32, agility: 0, technique: 16, breaking: 0, mental: 0}`
`current = 130, target = 130` → `{0,0,0,0,0}`（issue なし）
`current = 133, target = 130` → `INVALID_TARGET`

---

## 4. 青特殊能力の計算（`blueCalculator.ts`）

```ts
export function calculateBlueAbility(
  gameData: GameDataSet,
  senseMode: SenseMode,
  target: BlueTarget
): { item: CalculationItem | null; issues: CalculationIssue[] };
```

**プランの `playerType`（選手種別）は引数に取らない。** 青特の計算は常にその能力自身のマスタ上の `player_type` に基づいて行う（FR-BL-09）。これにより、投手プランで `player_type = fielder` 限定の青特（野手専用能力）を選択した場合でも、能力自身の `fielder` 行を参照して正しく計算できる。

### アルゴリズム

```text
1. meta = gameData.blueIndex.get(target.abilityId)
   if (!meta) → BLUE_DATA_MISSING

2. 状態集合 states = meta.abilityType === "binary" ? BINARY_STATES : RANK_STATES
   ci = states.indexOf(target.currentState)
   ti = states.indexOf(target.targetState)
   if (ci < 0 || ti < 0) → INVALID_TARGET
   if (ti <  ci)         → INVALID_TARGET
   if (ti === ci)        → cost = 0 の item を返す（issue なし）

3. 行の解決関数を定義する（能力自身の `meta.playerType` 完全一致 → "common" の順でフォールバック。
   プランの `playerType` は使用しない）:
       lookup(state, hl, sm) =
            gameData.blue.get(blueKey(target.abilityId, meta.playerType, state, hl, sm))
         ?? gameData.blue.get(blueKey(target.abilityId, "common",  state, hl, sm))

4. 【実測パス】対象区間の全遷移について
   (target.hintLevel, senseMode) に完全一致する行が存在するか判定する。
       exactRows = [lookup(states[i], target.hintLevel, senseMode) for i in [ci, ti)]
   if (exactRows に null が1つも無い) {
       cost = sumVectors(exactRows.map(r => r.cost))   ← 倍率・丸めを一切適用しない
       source = "measured"
       → 手順6へ
   }

5. 【基準行パス】基準行（hint_level=0 / sense_mode=normal）から倍率計算する。
   baseSum = zeroVector()
   for (i = ci; i < ti; i++) {
       row = lookup(states[i], 0, "normal")
       if (!row) → BLUE_DATA_MISSING（打ち切り）
       baseSum = addVector(baseSum, row.cost)
   }
   hint = gameData.hintRules.get(`blue|${target.hintLevel}`)
   if (!hint) → INVALID_CSV（ロード時検証で防止済み）
   senseMul = senseMode === "sense_plus"
              ? config.blueSensePlusMultiplier
              : config.blueNormalMultiplier
   各カテゴリ k について（独立に）:
       raw   = baseSum[k] * hint.multiplier * senseMul
       cost[k] = applyRounding(normalize(raw), hint.rounding)
   source = "master"

6. item = { category: "blue", id, displayName, detail: `${current} → ${target} / コツLv${hintLevel}`,
            cost, source, autoAdded }
```

### 重要な規定

- **実測パスと基準行パスを遷移単位で混在させてはならない。** 区間内の遷移のうち1つでも完全一致行を欠く場合は、区間全体を基準行パスで計算する。混在させると丸め位置が実装依存になるため。
- 実測パス（手順4）では**コツ倍率・センス倍率・丸めを一切適用しない**。CSVの値が既に当該条件での実測値であるため（金特と同じ方針）。
- 基準行パス（手順5）では **倍率の乗算を1回にまとめ、丸めは最後の1回のみ**行う。段階ごとに丸めてはならない。
  - `applyRounding(base × hintMul × senseMul)` であり、`applyRounding(applyRounding(base × hintMul) × senseMul)` ではない。
- `target.hintLevel = 0` かつ `senseMode = "normal"` のとき、手順4は必ず基準行にヒットする。このとき `source = "measured"` となり、値は基準行そのままである（基準行パスで計算しても倍率 1.00 × `blueNormalMultiplier` となり、`blueNormalMultiplier = 1.00` の既定値では同値）。
- 基準行以外の行を持たないデータでは、手順4は Lv0/normal 以外で必ず失敗し、原仕様と同一の計算結果になる。
- ランク型は**現在ランクから目標ランクまでの各遷移行のみ**を加算する。`G→F × 4 = D→C` のようなゲーム固有の関係をコードに持たせてはならない。
- 丸め方式は `hint_rules.csv` の当該行の `rounding` を使用する。
- センス倍率は青特にのみ適用する（金特・基礎能力・変化球には適用しない）。

### 計算例（基準行パス）

`power_hitter` の**基準行**が `{muscle:240, agility:15, technique:68, breaking:0, mental:8}` で、
コツLv1 / `sense_plus` の実測行が存在しないとき。コツLv1（倍率 0.70 / floor）、`sense_plus`（倍率 0.90）。

| カテゴリ | 計算 | 結果 |
|---|---|---|
| muscle | floor(240 × 0.70 × 0.90) = floor(151.2) | 151 |
| agility | floor(15 × 0.70 × 0.90) = floor(9.45) | 9 |
| technique | floor(68 × 0.70 × 0.90) = floor(42.84) | 42 |
| breaking | floor(0 × …) | 0 |
| mental | floor(8 × 0.70 × 0.90) = floor(5.04) | 5 |

`source = "master"`。

### 計算例（実測パス）

上記に加えて `power_hitter` の `hint_level=1` / `sense_mode=sense_plus` の行
`{muscle:150, agility:9, technique:42, breaking:0, mental:5}` が存在するとき、
コツLv1 / `sense_plus` のプランでは**この値をそのまま使用する**（倍率・丸めなし）。
`cost = {150, 9, 42, 0, 5}`、`source = "measured"`。基準行からの計算値 `{151,9,42,0,5}` は使用しない。

---

## 5. 金特殊能力の計算（`goldCalculator.ts`）

```ts
export function calculateGoldAbility(
  gameData: GameDataSet,
  senseMode: SenseMode,
  target: GoldTarget
): { item: CalculationItem | null; issues: CalculationIssue[] };
```

**プランの `playerType`（選手種別）は引数に取らない。** 金特の計算は常にその能力自身のマスタ上の `player_type` に基づいて行う（FR-BL-09）。`goldByAbility` は `abilityId` 単位でキー化されており、同一 `abilityId` の行は `gold_abilities.csv` の一意キー制約（`03_data_spec.md` §7）によりマスタ上常に単一の `player_type` に属するため、プランの `playerType` による追加の絞り込みは不要である。これにより、投手プランで `player_type = fielder` 限定の金特（野手専用能力）を選択した場合でも正しく計算できる。

### アルゴリズム

```text
1. rows = gameData.goldByAbility.get(`${target.abilityId}|${senseMode}`) ?? []
   if (rows.length === 0) → GOLD_DATA_MISSING（推定を行わない）

2. exact = rows.find(r => r.hintLevel === target.hintLevel)
   if (exact) → cost = exact.cost, source = "measured"   ← 推定処理を行わない

3. else → goldEstimator.estimate(rows, target.hintLevel, gameData) を呼ぶ
       measuredCount >= 2 → source = "estimated_high"
       measuredCount === 1 → source = "estimated"

4. item = { category: "gold", id, displayName, detail: `コツLv${hintLevel}`, cost, source }
```

**金特の必要経験点にコツ倍率・センス倍率を重ねて適用してはならない。** `gold_abilities.csv` の値は既に当該 `hint_level` / `sense_mode` での実測値である。

---

## 6. 金特の推定（`estimator/goldEstimator.ts`）

```ts
export function estimateGoldCost(
  measuredRows: GoldAbilityRow[],   // 同一 abilityId / senseMode の実測行（1件以上）
  targetHintLevel: number,
  hintRules: Map<string, HintRule>,
  searchMax: number                 // config.goldEstimateSearchMax
): { cost: ExpVector; baseValues: ExpVector; confidence: "estimated" | "estimated_high" };
```

### 6.1 仮想基礎値 B の逆算

各経験点カテゴリ k について**独立に** B を求める。

```text
対象: カテゴリ k
実測行 i = 1..n（Lv = L_i、実測値 = M_i）
倍率  R_i = hintRules.get(`gold|${L_i}`).multiplier
丸め  round_i = hintRules.get(`gold|${L_i}`).rounding

bestB = 0
bestError = +∞
for (B = 0; B <= searchMax; B++) {
    totalError = Σ_i | applyRounding(normalize(B * R_i), round_i) - M_i |
    if (totalError < bestError) { bestError = totalError; bestB = B; }
    // 同点の場合は更新しない → 最小の B が採用される
}
return bestB
```

- `totalError` が同点の場合、**より小さい B を採用する**（上記ループは `<` 比較なので自動的に満たされる）。
- 探索範囲は `0 <= B <= searchMax`（既定 10000）。
- 計算量は 1カテゴリあたり `(searchMax + 1) × n` 回。5カテゴリで最大 50,005 × n 回。

### 6.2 推定値の算出

```text
Rt      = hintRules.get(`gold|${targetHintLevel}`).multiplier
round_t = hintRules.get(`gold|${targetHintLevel}`).rounding
cost[k] = applyRounding(normalize(B[k] * Rt), round_t)
```

### 6.3 信頼度

| 条件 | `source` | 画面表示 |
|---|---|---|
| 対象Lvの実測行が存在 | `measured` | `実測` |
| 実測行が2件以上（対象Lv以外） | `estimated_high` | `高信頼推定` |
| 実測行が1件のみ（対象Lv以外） | `estimated` | `推定` |
| 実測行が0件 | — | `データ不足` |

### 6.4 禁止事項

- 他の金特の実測値から推定してはならない。
- 異なる `sense_mode` の実測値から推定してはならない。
- 異なる `player_type` の実測値から推定してはならない（`common` を除く）。
- 実測値が存在するLvに対して推定値を使用してはならない（**measured > estimated**、原仕様 §24）。

### 6.5 計算例

`archartist` の実測が Lv1 のみ（muscle = 100）、`gold` の倍率が Lv1 = 0.70 / Lv3 = 0.40（ともに floor）のとき。

```text
B の探索:
  B = 142 → floor(142 × 0.70) = floor(99.4)  = 99  → error 1
  B = 143 → floor(143 × 0.70) = floor(100.1) = 100 → error 0  ← 最小の B
  B = 144 → floor(144 × 0.70) = floor(100.8) = 100 → error 0（同点だが B が大きいので不採用）
→ B = 143

Lv3 の推定:
  floor(143 × 0.40) = floor(57.2) = 57
→ muscle = 57, source = "estimated"
```

---

## 7. 変化球の計算（`breakingCalculator.ts`）

```ts
export function calculateBreaking(
  gameData: GameDataSet,
  senseMode: SenseMode,
  plan: BreakingPlan | null
): { items: CalculationItem[]; issues: CalculationIssue[] };
```

### 優先順位（原仕様 §32）

```text
1. plan.mode === "aggregate" かつ plan.aggregate != null
     → その値をそのまま使用。source = "manual"。以降の解決を行わない。

2. plan.mode === "step"
     各ステップについて:
       a. step.cost != null            → その値を使用。source = "manual"
       b. キャッシュ完全一致            → キャッシュ値を使用。source = "measured"
       c. どちらもなし                  → BREAKING_DATA_MISSING（0 としない）

3. plan == null または plan.mode === "none"
     → 目標構成が1件でも入力されていれば BREAKING_DATA_MISSING
     → 目標構成が空なら cost = 0（issue なし。変化球を取得しないプラン）
```

### キャッシュ参照キー

```text
senseMode に応じてテーブルを選択（breakingSensePlus / breakingNormal）
key = breakingKey(pitchType, fromLevel, totalBreakBefore, pitchCountBefore)
```

**完全一致のみ。** 部分一致・近似・補間・外挿は禁止。

### 禁止事項

- 変化球の必要経験点を**推定してはならない**（原仕様 §32）。
- データがない場合に 0 として計算してはならない。必ず `BREAKING_DATA_MISSING` を発生させ、結果ステータスを `incomplete` にする。
- 野手プラン（`playerType === "fielder"`）では変化球計算を行わない（`items = []`、issue なし）。

---

## 8. プラン全体の計算（`planCalculator.ts`）

```ts
export function calculatePlan(
  gameData: GameDataSet,
  plan: PlayerPlan
): CalculationResult;
```

### 処理順序（原仕様 §44 準拠）

```text
(1) 基礎能力
      plan.targetBase の全 abilityId について calculateBaseAbility を実行

(2) 青特（ユーザー指定分）を収集
      plan.blueTargets をリスト化

(3) 金特の下位青特を自動追加
      plan.goldTargets の各 goldId について gameData.goldPrereq を参照し、
      前提青特を BlueTarget として生成する:
        abilityId    = prereq.lowerBlueId
        currentState = plan.blueTargets に同一 abilityId があればその currentState、
                       なければ binary → "NONE" / rank → "G"
        targetState  = prereq.requiredState
        hintLevel    = goldTarget.lowerAbilityHintLevel
        autoAdded    = true

(4) 青特の重複排除（マージ）
      同一 abilityId の BlueTarget が複数ある場合、1件へマージする。§8.1 参照。

(5) 青特の必要経験点計算
      マージ後の各 BlueTarget について calculateBlueAbility を実行

(6) 金特の必要経験点計算
      plan.goldTargets の各件について calculateGoldAbility を実行（実測 or 推定）

(7) 変化球の必要経験点計算
      calculateBreaking を実行

(8) 合計
      subtotal[category] = 各カテゴリ items の cost 合計
      total = 全 items の cost 合計
      status を判定（§8.2）
```

### 8.1 青特マージ規則（重複防止・原仕様 §45）

同一 `abilityId` の `BlueTarget` が複数存在する場合、**必ず1件へマージする**。二重計上は重大な欠陥とする。

| 項目 | マージ規則 |
|---|---|
| `currentState` | 各候補の中で**最も進んだ状態**（状態順序が最大のもの）。ユーザーが「すでに所持」と申告した情報を優先するため。 |
| `targetState` | 各候補の中で**最も進んだ状態**（状態順序が最大のもの）。 |
| `hintLevel` | **ユーザーが明示指定した `BlueTarget` の値**を優先する。ユーザー指定が無く自動追加のみの場合は、自動追加分のうち**最大の `hintLevel`**（＝最も安くなる値）を採用する。 |
| `autoAdded` | ユーザー指定が1件でもあれば `false`、すべて自動追加なら `true`。 |

マージ後に `currentState >= targetState` となった場合、その青特の cost は 0（すでに条件を満たしている）。

**例1**: ユーザーが `power_hitter`（NONE→ON, コツLv4）を指定し、かつ `archartist`（前提 = `power_hitter` ON, `lowerAbilityHintLevel = 2`）を指定した場合
→ `power_hitter` は1件のみ。`hintLevel = 4`（ユーザー指定を優先）。`power_hitter` の cost は1回だけ計上される。

**例2**: ユーザーが `power_hitter` を `currentState = ON` として所持済み申告し、`archartist` を指定した場合
→ `power_hitter` は `ON → ON` となり cost = 0。金特 `archartist` の cost のみ計上される（原仕様 §25）。

**例3**: `clutch_master`（前提 = `chance` A）を指定し、プランの `chance` 現在ランクが D の場合
→ `chance` の `D → A` として `D→C`, `C→B`, `B→A` の3遷移を計上する。

### 8.2 結果ステータス判定

```text
if (issues に BASE_DATA_MISSING / BLUE_DATA_MISSING / GOLD_DATA_MISSING /
              BREAKING_DATA_MISSING / INVALID_TARGET が1件でもある)
    → "incomplete"
else if (items に source === "estimated" または "estimated_high" が1件でもある)
    → "estimated"
else
    → "confirmed"
```

判定は上から順に評価する（`incomplete` が最優先）。

### 8.3 出力順序

`base` / `blue` / `gold` / `breaking` の各配列は以下の順で並べる（再現性確保のため）。

| 配列 | 並び順 |
|---|---|
| `base` | `base_ability_defs.display_order` 昇順 |
| `blue` | ユーザー指定分（入力順）→ 自動追加分（`abilityId` 昇順） |
| `gold` | ユーザー指定の入力順 |
| `breaking` | `mode = aggregate` は1件。`mode = step` は `seq` 昇順 |

---

## 9. 端数・境界条件の一覧

| 条件 | 期待動作 |
|---|---|
| 目標値 = 現在値 | cost = 0、issue なし |
| 目標値 < 現在値 | `INVALID_TARGET`、cost = 0 |
| コツLv = 0 | 倍率 1.00（`hint_rules` の Lv0 行を使用。倍率1.00を仮定してハードコードしない） |
| CSV の cost が全て 0 | 正常。cost = 0 として計上する（データ不足ではない） |
| CSV に該当行なし | `*_DATA_MISSING`。**0 補完禁止** |
| 倍率適用後の値が 0 未満 | 発生しない（入力は0以上・倍率は正） |
| 基礎値 0 に倍率適用 | 0 |
| 目標特殊能力が0件 | blue/gold ともに空配列、issue なし |
| 変化球目標が0件（投手） | cost = 0、issue なし |
| 変化球目標あり・データなし | `BREAKING_DATA_MISSING` |
| 野手プランの変化球 | 計算対象外（items 空、issue なし） |

---

## 10. 一意キー生成（`data/repositories/keyBuilder.ts`）

区切り文字は `|` とする。キー生成関数は本仕様のとおり実装し、他の形式を用いてはならない。

```ts
export const baseKey = (playerType: string, abilityId: string, fromValue: number) =>
  `${playerType}|${abilityId}|${fromValue}`;
// 例: "pitcher|velocity|130"

export const blueKey = (
  abilityId: string, playerType: string, fromState: string,
  hintLevel: number, senseMode: string
) => `${abilityId}|${playerType}|${fromState}|${hintLevel}|${senseMode}`;
// 例: "chance|fielder|D|0|normal"

export const goldKey = (abilityId: string, playerType: string, hintLevel: number, senseMode: string) =>
  `${abilityId}|${playerType}|${hintLevel}|${senseMode}`;
// 例: "archartist|fielder|3|sense_plus"

export const hintKey = (abilityType: string, hintLevel: number) =>
  `${abilityType}|${hintLevel}`;
// 例: "gold|3"

export const breakingKey = (
  pitchType: string, fromLevel: number,
  totalBreakBefore: number, pitchCountBefore: number
) => `${pitchType}|${fromLevel}|${totalBreakBefore}|${pitchCountBefore}`;
// 例: "slider|2|5|2"
```

`to_value` / `to_level` はキーに含めない（`from + 1` で一意に決まるため）。
