/**
 * 各CSVのカラム定義（03_data_spec.md §2〜§10）。
 * ここに書かれた列名・ファイル名がCSV仕様の唯一の情報源であり、
 * ゲーム固有の「値」は一切持たない。
 */

export const CSV_KINDS = [
  "config",
  "base_ability_defs",
  "base_sense_plus",
  "base_normal",
  "blue_abilities",
  "gold_abilities",
  "gold_prerequisites",
  "hint_rules",
  "breaking_cache_sense_plus",
  "breaking_cache_normal",
] as const;

export type CsvKind = (typeof CSV_KINDS)[number];

export const CSV_FILE_NAMES: Record<CsvKind, string> = {
  config: "config.csv",
  base_ability_defs: "base_ability_defs.csv",
  base_sense_plus: "base_sense_plus.csv",
  base_normal: "base_normal.csv",
  blue_abilities: "blue_abilities.csv",
  gold_abilities: "gold_abilities.csv",
  gold_prerequisites: "gold_prerequisites.csv",
  hint_rules: "hint_rules.csv",
  breaking_cache_sense_plus: "breaking_cache_sense_plus.csv",
  breaking_cache_normal: "breaking_cache_normal.csv",
};

/** 必須ファイル（V-01）。 */
export const REQUIRED_CSV_KINDS: readonly CsvKind[] = [
  "config",
  "base_ability_defs",
  "blue_abilities",
  "gold_abilities",
  "gold_prerequisites",
  "hint_rules",
];

/** 条件付き必須。少なくとも一方が存在すること。 */
export const CONDITIONAL_CSV_KINDS: readonly CsvKind[] = ["base_sense_plus", "base_normal"];

/** 任意ファイル。無ければ空データとして扱う。 */
export const OPTIONAL_CSV_KINDS: readonly CsvKind[] = [
  "breaking_cache_sense_plus",
  "breaking_cache_normal",
];

/** 経験点5カラム。この5つを持つファイルでは全カラム必須（空欄は 0 と区別しエラー）。 */
export const EXP_COLUMNS = ["muscle", "agility", "technique", "breaking", "mental"] as const;

/** 各ファイルの必須カラム。出力時の列順も本定義に従う。 */
export const CSV_COLUMNS: Record<CsvKind, readonly string[]> = {
  config: ["key", "value"],
  base_ability_defs: [
    "ability_id",
    "display_name",
    "player_type",
    "min_value",
    "max_value",
    "display_order",
    "value_type",
  ],
  base_sense_plus: ["player_type", "ability_id", "from_value", "to_value", ...EXP_COLUMNS],
  base_normal: ["player_type", "ability_id", "from_value", "to_value", ...EXP_COLUMNS],
  blue_abilities: [
    "ability_id",
    "display_name",
    "player_type",
    "ability_type",
    "from_state",
    "to_state",
    "hint_level",
    "sense_mode",
    ...EXP_COLUMNS,
  ],
  gold_abilities: [
    "ability_id",
    "display_name",
    "player_type",
    "hint_level",
    "sense_mode",
    ...EXP_COLUMNS,
    "data_type",
  ],
  gold_prerequisites: ["gold_id", "lower_blue_id", "required_state"],
  hint_rules: ["ability_type", "hint_level", "multiplier", "rounding"],
  breaking_cache_sense_plus: [
    "pitch_type",
    "from_level",
    "to_level",
    "total_break_before",
    "pitch_count_before",
    ...EXP_COLUMNS,
  ],
  breaking_cache_normal: [
    "pitch_type",
    "from_level",
    "to_level",
    "total_break_before",
    "pitch_count_before",
    ...EXP_COLUMNS,
  ],
};

/** 数値カラムの共通範囲（03_data_spec.md §1）。 */
export const NUMERIC_MIN = 0;
export const NUMERIC_MAX = 99999;

/** ID の書式。 */
export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const PLAYER_TYPES = ["pitcher", "fielder", "common"] as const;
export const BASE_DEF_PLAYER_TYPES = ["pitcher", "fielder"] as const;
export const SENSE_MODES = ["normal", "sense_plus"] as const;
export const ABILITY_TYPES = ["binary", "rank"] as const;
export const HINT_TARGET_TYPES = ["blue", "gold"] as const;
export const ROUNDING_MODES = ["floor", "round", "ceil"] as const;
export const VALUE_TYPES = ["numeric", "trajectory"] as const;
export const GOLD_DATA_TYPES = ["measured"] as const;

export const HINT_LEVEL_MIN = 0;
export const HINT_LEVEL_MAX = 5;

export const BREAKING_LEVEL_MIN = 0;
export const BREAKING_LEVEL_MAX = 7;
export const TOTAL_BREAK_MAX = 99;
export const PITCH_COUNT_MAX = 10;

/** config.csv の設定キー定義（03_data_spec.md §3）。未定義キーは既定値を使う。 */
export interface ConfigKeySpec {
  kind: "decimal" | "integer";
  min: number;
  max: number;
  defaultValue: number;
}

export const CONFIG_KEY_SPECS: Record<string, ConfigKeySpec> = {
  blue_sense_plus_multiplier: { kind: "decimal", min: 0.01, max: 1.0, defaultValue: 1.0 },
  blue_normal_multiplier: { kind: "decimal", min: 0.01, max: 1.0, defaultValue: 1.0 },
  gold_estimate_search_max: { kind: "integer", min: 1, max: 100000, defaultValue: 10000 },
};

/** 計算結果CSVの列構成（06_persistence_spec.md §4.1）。 */
export const RESULT_CSV_COLUMNS = [
  "category",
  "id",
  "display_name",
  "detail",
  "source",
  ...EXP_COLUMNS,
] as const;
