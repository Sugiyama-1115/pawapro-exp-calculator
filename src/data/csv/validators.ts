/**
 * CSV検証（03_data_spec.md §11 の V-01〜V-27）。
 * 例外は投げず、ValidationIssue を全件収集して返す（07_error_spec.md §4）。
 */
import type { ValidationIssue } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type {
  AbilityType,
  BaseAbilityDef,
  BaseCostRow,
  BlueAbilityRow,
  BreakingCacheRow,
  GoldAbilityRow,
  GoldPrerequisite,
  HintRule,
  PlayerType,
  RoundingMode,
  SenseMode,
} from "@/domain/models/ability";
import { statesOf } from "@/domain/models/ability";
import type { ExpVector } from "@/domain/models/expVector";
import type { CsvRow, ParsedCsv } from "./csvParser";
import { toCamelCase } from "./csvParser";
import type { CsvKind } from "./schemas";
import {
  ABILITY_TYPES,
  BASE_DEF_PLAYER_TYPES,
  BREAKING_LEVEL_MAX,
  BREAKING_LEVEL_MIN,
  CONDITIONAL_CSV_KINDS,
  CONFIG_KEY_SPECS,
  CSV_COLUMNS,
  CSV_FILE_NAMES,
  GOLD_DATA_TYPES,
  HINT_LEVEL_MAX,
  HINT_LEVEL_MIN,
  HINT_TARGET_TYPES,
  ID_PATTERN,
  NUMERIC_MAX,
  NUMERIC_MIN,
  PITCH_COUNT_MAX,
  PLAYER_TYPES,
  REQUIRED_CSV_KINDS,
  ROUNDING_MODES,
  SENSE_MODES,
  TOTAL_BREAK_MAX,
  VALUE_TYPES,
} from "./schemas";

/** 報告するエラーの上限（03_data_spec.md §11）。 */
export const MAX_ISSUES = 200;

/** 検証済み行。`line` は CSV の行番号（参照整合エラーの報告に使う）。 */
export type SourcedRow<T> = T & { line: number };

export interface ConfigRow {
  key: string;
  value: string;
}

export interface ValidatedGameData {
  config: SourcedRow<ConfigRow>[];
  base_ability_defs: SourcedRow<BaseAbilityDef>[];
  base_sense_plus: SourcedRow<BaseCostRow>[];
  base_normal: SourcedRow<BaseCostRow>[];
  blue_abilities: SourcedRow<BlueAbilityRow>[];
  gold_abilities: SourcedRow<GoldAbilityRow>[];
  gold_prerequisites: SourcedRow<GoldPrerequisite>[];
  hint_rules: SourcedRow<HintRule>[];
  breaking_cache_sense_plus: SourcedRow<BreakingCacheRow>[];
  breaking_cache_normal: SourcedRow<BreakingCacheRow>[];
}

export interface FileValidationResult<K extends CsvKind> {
  issues: ValidationIssue[];
  rows: ValidatedGameData[K];
}

export interface DataSetValidationResult {
  issues: ValidationIssue[];
  /** 上限を超えて切り捨てた件数。 */
  omittedCount: number;
  /** エラーが1件でもあれば null（ロード中止）。 */
  data: ValidatedGameData | null;
}

export function emptyGameData(): ValidatedGameData {
  return {
    config: [],
    base_ability_defs: [],
    base_sense_plus: [],
    base_normal: [],
    blue_abilities: [],
    gold_abilities: [],
    gold_prerequisites: [],
    hint_rules: [],
    breaking_cache_sense_plus: [],
    breaking_cache_normal: [],
  };
}

// ---------------------------------------------------------------------------
// 行単位の読み取りヘルパ
// ---------------------------------------------------------------------------

class RowReader {
  readonly issues: ValidationIssue[] = [];
  private ok = true;

  constructor(
    private readonly file: string,
    private readonly row: CsvRow,
  ) {}

  get line(): number {
    return this.row.line;
  }

  get valid(): boolean {
    return this.ok;
  }

  raw(column: string): string {
    return this.row.values[toCamelCase(column)] ?? "";
  }

  fail(code: string, column: string | null, message: string): void {
    this.ok = false;
    this.issues.push({ code, file: this.file, line: this.row.line, column, message });
  }

  /** V-03 / V-04: 0以上の整数。範囲は呼び出し側で指定する。 */
  int(column: string, min = NUMERIC_MIN, max = NUMERIC_MAX): number {
    const raw = this.raw(column);
    if (!/^\d+$/.test(raw)) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は 0 以上の整数ではありません。`,
      );
      return 0;
    }
    const value = Number(raw);
    if (value < min || value > max) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は ${min}〜${max} の範囲で指定してください。`,
      );
      return 0;
    }
    return value;
  }

  /** V-05: 経験点カラムは空欄を 0 として扱わない。 */
  private expInt(column: string): number {
    const raw = this.raw(column);
    if (raw === "") {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} が空欄です。経験点は 0 と空欄を区別します。`,
      );
      return 0;
    }
    return this.int(column);
  }

  exp(): ExpVector {
    return {
      muscle: this.expInt("muscle"),
      agility: this.expInt("agility"),
      technique: this.expInt("technique"),
      breaking: this.expInt("breaking"),
      mental: this.expInt("mental"),
    };
  }

  /** V-06: ID 書式。 */
  id(column: string): string {
    const raw = this.raw(column);
    if (!ID_PATTERN.test(raw)) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は英小文字・数字・アンダースコアのIDである必要があります。`,
      );
      return "";
    }
    return raw;
  }

  text(column: string): string {
    const raw = this.raw(column);
    if (raw === "") {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} が空欄です。`,
      );
    }
    return raw;
  }

  /** V-07〜V-12: 列挙値。 */
  enumValue<T extends string>(column: string, allowed: readonly T[]): T {
    const raw = this.raw(column);
    const hit = allowed.find((candidate) => candidate === raw);
    if (hit === undefined) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は ${allowed.join(" / ")} のいずれかである必要があります。`,
      );
      const fallback = allowed[0];
      return fallback === undefined ? ("" as T) : fallback;
    }
    return hit;
  }

  decimal(column: string, min: number, max: number): number {
    const raw = this.raw(column);
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は小数として解釈できません。`,
      );
      return 0;
    }
    const value = Number(raw);
    if (value < min || value > max) {
      this.fail(
        ERROR_CODES.INVALID_CSV,
        column,
        `${this.file} ${this.line}行目: 列 ${column} の値「${raw}」は ${min}〜${max} の範囲で指定してください。`,
      );
      return 0;
    }
    return value;
  }
}

/** V-16: 一意キーの重複検出。 */
class DuplicateTracker {
  private readonly seen = new Map<string, number>();

  constructor(private readonly file: string) {}

  check(key: string, description: string, line: number): ValidationIssue | null {
    const first = this.seen.get(key);
    if (first !== undefined) {
      return {
        code: ERROR_CODES.DUPLICATE_DATA,
        file: this.file,
        line,
        column: null,
        message: `${this.file} ${line}行目: キー（${description}）が ${first}行目と重複しています。`,
      };
    }
    this.seen.set(key, line);
    return null;
  }
}

/** V-02: 必須カラムの存在確認。 */
function checkColumns(kind: CsvKind, parsed: ParsedCsv, file: string): ValidationIssue[] {
  const present = new Set(parsed.headers);
  const issues: ValidationIssue[] = [];
  for (const column of CSV_COLUMNS[kind]) {
    if (!present.has(toCamelCase(column))) {
      issues.push({
        code: ERROR_CODES.INVALID_CSV,
        file,
        line: null,
        column,
        message: `${file}: 必須カラム「${column}」がありません。`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// ファイル種別ごとの検証
// ---------------------------------------------------------------------------

interface RawResult {
  issues: ValidationIssue[];
  rows: unknown[];
}

function validateConfigFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<ConfigRow>[] = [];
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const key = reader.text("key");
    const value = reader.text("value");
    // V-25: 定義済みキーのみ型・範囲を検査する。未定義キーは既定値運用のため無視する。
    const spec = CONFIG_KEY_SPECS[key];
    if (spec) {
      if (spec.kind === "decimal") {
        reader.decimal("value", spec.min, spec.max);
      } else {
        reader.int("value", spec.min, spec.max);
      }
    }
    issues.push(...reader.issues);
    if (reader.valid) rows.push({ key, value, line: row.line });
  }
  return { issues, rows };
}

function validateBaseDefsFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<BaseAbilityDef>[] = [];
  const dup = new DuplicateTracker(file);
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const abilityId = reader.id("ability_id");
    const displayName = reader.text("display_name");
    const playerType = reader.enumValue("player_type", BASE_DEF_PLAYER_TYPES);
    const minValue = reader.int("min_value");
    const maxValue = reader.int("max_value");
    const displayOrder = reader.int("display_order");
    const valueType = reader.enumValue("value_type", VALUE_TYPES);
    // V-26
    if (reader.valid && maxValue < minValue) {
      reader.fail(
        ERROR_CODES.INVALID_CSV,
        "max_value",
        `${file} ${row.line}行目: max_value は min_value 以上である必要があります（min=${minValue}, max=${maxValue}）。`,
      );
    }
    issues.push(...reader.issues);
    if (!reader.valid) continue;
    const duplicate = dup.check(
      `${playerType}|${abilityId}`,
      `player_type=${playerType}, ability_id=${abilityId}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }
    rows.push({
      abilityId,
      displayName,
      playerType,
      minValue,
      maxValue,
      displayOrder,
      valueType,
      line: row.line,
    });
  }
  return { issues, rows };
}

function validateBaseCostFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<BaseCostRow>[] = [];
  const dup = new DuplicateTracker(file);
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const playerType = reader.enumValue<PlayerType>("player_type", PLAYER_TYPES);
    const abilityId = reader.id("ability_id");
    const fromValue = reader.int("from_value");
    const toValue = reader.int("to_value");
    const cost = reader.exp();
    // V-13
    if (reader.valid && toValue !== fromValue + 1) {
      reader.fail(
        ERROR_CODES.INVALID_CSV,
        "to_value",
        `${file} ${row.line}行目: to_value は from_value + 1 である必要があります（from=${fromValue}, to=${toValue}）。`,
      );
    }
    issues.push(...reader.issues);
    if (!reader.valid) continue;
    const duplicate = dup.check(
      `${playerType}|${abilityId}|${fromValue}`,
      `player_type=${playerType}, ability_id=${abilityId}, from_value=${fromValue}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }
    rows.push({ playerType, abilityId, fromValue, toValue, cost, line: row.line });
  }
  return { issues, rows };
}

interface AbilityIdentity {
  line: number;
  displayName: string;
  playerType: PlayerType;
  abilityType?: AbilityType;
}

/** V-17: 同一 ability_id の属性が矛盾しないこと。 */
function checkIdentity(
  known: Map<string, AbilityIdentity>,
  file: string,
  abilityId: string,
  current: AbilityIdentity,
): ValidationIssue[] {
  const first = known.get(abilityId);
  if (!first) {
    known.set(abilityId, current);
    return [];
  }
  const issues: ValidationIssue[] = [];
  const push = (column: string, actual: string, expected: string): void => {
    issues.push({
      code: ERROR_CODES.INVALID_CSV,
      file,
      line: current.line,
      column,
      message: `${file} ${current.line}行目: ability_id「${abilityId}」の ${column}「${actual}」が ${first.line}行目の「${expected}」と一致しません。`,
    });
  };
  if (first.displayName !== current.displayName) {
    push("display_name", current.displayName, first.displayName);
  }
  if (first.playerType !== current.playerType) {
    push("player_type", current.playerType, first.playerType);
  }
  if (first.abilityType !== current.abilityType) {
    push("ability_type", current.abilityType ?? "", first.abilityType ?? "");
  }
  return issues;
}

function validateBlueFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<BlueAbilityRow>[] = [];
  const dup = new DuplicateTracker(file);
  const identities = new Map<string, AbilityIdentity>();

  interface TransitionInfo {
    line: number;
    abilityId: string;
    fromState: string;
    toState: string;
    hasBaseline: boolean;
  }
  const transitions = new Map<string, TransitionInfo>();

  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const abilityId = reader.id("ability_id");
    const displayName = reader.text("display_name");
    const playerType = reader.enumValue<PlayerType>("player_type", PLAYER_TYPES);
    const abilityType = reader.enumValue<AbilityType>("ability_type", ABILITY_TYPES);
    const hintLevel = reader.int("hint_level", HINT_LEVEL_MIN, HINT_LEVEL_MAX);
    const senseMode = reader.enumValue<SenseMode>("sense_mode", SENSE_MODES);
    const fromState = reader.raw("from_state");
    const toState = reader.raw("to_state");
    const cost = reader.exp();

    if (reader.valid) {
      const states = statesOf(abilityType);
      const fromIndex = states.indexOf(fromState);
      const toIndex = states.indexOf(toState);
      // V-11: 状態値が ability_type に対応する集合に含まれること
      if (fromIndex < 0) {
        reader.fail(
          ERROR_CODES.INVALID_CSV,
          "from_state",
          `${file} ${row.line}行目: 列 from_state の値「${fromState}」は ${states.join(" / ")} のいずれかである必要があります。`,
        );
      }
      if (toIndex < 0) {
        reader.fail(
          ERROR_CODES.INVALID_CSV,
          "to_state",
          `${file} ${row.line}行目: 列 to_state の値「${toState}」は ${states.join(" / ")} のいずれかである必要があります。`,
        );
      }
      // V-15: binary は NONE→ON のみ / rank は1段階ずつ
      if (fromIndex >= 0 && toIndex >= 0 && toIndex !== fromIndex + 1) {
        reader.fail(
          ERROR_CODES.INVALID_CSV,
          "to_state",
          `${file} ${row.line}行目: 遷移 ${fromState}→${toState} は1段階ではありません。1段階ずつの行に分けてください。`,
        );
      }
    }

    issues.push(...reader.issues);
    if (!reader.valid) continue;

    issues.push(
      ...checkIdentity(identities, file, abilityId, {
        line: row.line,
        displayName,
        playerType,
        abilityType,
      }),
    );

    const duplicate = dup.check(
      `${abilityId}|${playerType}|${fromState}|${hintLevel}|${senseMode}`,
      `ability_id=${abilityId}, player_type=${playerType}, from_state=${fromState}, hint_level=${hintLevel}, sense_mode=${senseMode}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }

    const transitionKey = `${abilityId}|${playerType}|${fromState}`;
    const isBaseline = hintLevel === 0 && senseMode === "normal";
    const info = transitions.get(transitionKey);
    if (info) {
      info.hasBaseline = info.hasBaseline || isBaseline;
    } else {
      transitions.set(transitionKey, {
        line: row.line,
        abilityId,
        fromState,
        toState,
        hasBaseline: isBaseline,
      });
    }

    rows.push({
      abilityId,
      displayName,
      playerType,
      abilityType,
      fromState,
      toState,
      hintLevel,
      senseMode,
      cost,
      line: row.line,
    });
  }

  // V-27: 各遷移に基準行（hint_level=0 / sense_mode=normal）が必要
  for (const info of transitions.values()) {
    if (info.hasBaseline) continue;
    issues.push({
      code: ERROR_CODES.INVALID_CSV,
      file,
      line: info.line,
      column: null,
      message: `${file} ${info.line}行目: ${info.abilityId} の ${info.fromState}→${info.toState} に基準行（hint_level=0 / sense_mode=normal）がありません。`,
    });
  }

  return { issues, rows };
}

function validateGoldFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<GoldAbilityRow>[] = [];
  const dup = new DuplicateTracker(file);
  const identities = new Map<string, AbilityIdentity>();

  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const abilityId = reader.id("ability_id");
    const displayName = reader.text("display_name");
    const playerType = reader.enumValue<PlayerType>("player_type", PLAYER_TYPES);
    const hintLevel = reader.int("hint_level", HINT_LEVEL_MIN, HINT_LEVEL_MAX);
    const senseMode = reader.enumValue<SenseMode>("sense_mode", SENSE_MODES);
    const cost = reader.exp();
    // V-24: measured 以外（estimated 等）は許可しない
    reader.enumValue("data_type", GOLD_DATA_TYPES);

    issues.push(...reader.issues);
    if (!reader.valid) continue;

    issues.push(
      ...checkIdentity(identities, file, abilityId, { line: row.line, displayName, playerType }),
    );

    const duplicate = dup.check(
      `${abilityId}|${playerType}|${hintLevel}|${senseMode}`,
      `ability_id=${abilityId}, player_type=${playerType}, hint_level=${hintLevel}, sense_mode=${senseMode}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }

    rows.push({ abilityId, displayName, playerType, hintLevel, senseMode, cost, line: row.line });
  }

  return { issues, rows };
}

function validatePrerequisiteFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<GoldPrerequisite>[] = [];
  const dup = new DuplicateTracker(file);
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const goldId = reader.id("gold_id");
    const lowerBlueId = reader.id("lower_blue_id");
    const requiredState = reader.text("required_state");
    issues.push(...reader.issues);
    if (!reader.valid) continue;
    const duplicate = dup.check(
      `${goldId}|${lowerBlueId}`,
      `gold_id=${goldId}, lower_blue_id=${lowerBlueId}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }
    rows.push({ goldId, lowerBlueId, requiredState, line: row.line });
  }
  return { issues, rows };
}

function validateHintRulesFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<HintRule>[] = [];
  const dup = new DuplicateTracker(file);
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const abilityType = reader.enumValue("ability_type", HINT_TARGET_TYPES);
    const hintLevel = reader.int("hint_level", HINT_LEVEL_MIN, HINT_LEVEL_MAX);
    const multiplier = reader.decimal("multiplier", 0.01, 1.0);
    const rounding = reader.enumValue<RoundingMode>("rounding", ROUNDING_MODES);
    issues.push(...reader.issues);
    if (!reader.valid) continue;
    const duplicate = dup.check(
      `${abilityType}|${hintLevel}`,
      `ability_type=${abilityType}, hint_level=${hintLevel}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }
    rows.push({ abilityType, hintLevel, multiplier, rounding, line: row.line });
  }

  // V-23: blue / gold × Lv0〜5 の12行が揃っていること
  const present = new Set(rows.map((r) => `${r.abilityType}|${r.hintLevel}`));
  for (const abilityType of HINT_TARGET_TYPES) {
    for (let level = HINT_LEVEL_MIN; level <= HINT_LEVEL_MAX; level++) {
      if (present.has(`${abilityType}|${level}`)) continue;
      issues.push({
        code: ERROR_CODES.INVALID_CSV,
        file,
        line: null,
        column: null,
        message: `${file}: ${abilityType} のコツLv${level} の行がありません。blue / gold それぞれ Lv0〜Lv5 の6行が必須です。`,
      });
    }
  }

  return { issues, rows };
}

function validateBreakingFile(parsed: ParsedCsv, file: string): RawResult {
  const issues: ValidationIssue[] = [];
  const rows: SourcedRow<BreakingCacheRow>[] = [];
  const dup = new DuplicateTracker(file);
  for (const row of parsed.rows) {
    const reader = new RowReader(file, row);
    const pitchType = reader.id("pitch_type");
    const fromLevel = reader.int("from_level", BREAKING_LEVEL_MIN, BREAKING_LEVEL_MAX);
    const toLevel = reader.int("to_level", BREAKING_LEVEL_MIN + 1, BREAKING_LEVEL_MAX);
    const totalBreakBefore = reader.int("total_break_before", 0, TOTAL_BREAK_MAX);
    const pitchCountBefore = reader.int("pitch_count_before", 0, PITCH_COUNT_MAX);
    const cost = reader.exp();
    // V-14
    if (reader.valid && toLevel !== fromLevel + 1) {
      reader.fail(
        ERROR_CODES.INVALID_CSV,
        "to_level",
        `${file} ${row.line}行目: to_level は from_level + 1 である必要があります（from=${fromLevel}, to=${toLevel}）。`,
      );
    }
    issues.push(...reader.issues);
    if (!reader.valid) continue;
    const duplicate = dup.check(
      `${pitchType}|${fromLevel}|${totalBreakBefore}|${pitchCountBefore}`,
      `pitch_type=${pitchType}, from_level=${fromLevel}, total_break_before=${totalBreakBefore}, pitch_count_before=${pitchCountBefore}`,
      row.line,
    );
    if (duplicate) {
      issues.push(duplicate);
      continue;
    }
    rows.push({
      pitchType,
      fromLevel,
      toLevel,
      totalBreakBefore,
      pitchCountBefore,
      cost,
      line: row.line,
    });
  }
  return { issues, rows };
}

const FILE_VALIDATORS: Record<CsvKind, (parsed: ParsedCsv, file: string) => RawResult> = {
  config: validateConfigFile,
  base_ability_defs: validateBaseDefsFile,
  base_sense_plus: validateBaseCostFile,
  base_normal: validateBaseCostFile,
  blue_abilities: validateBlueFile,
  gold_abilities: validateGoldFile,
  gold_prerequisites: validatePrerequisiteFile,
  hint_rules: validateHintRulesFile,
  breaking_cache_sense_plus: validateBreakingFile,
  breaking_cache_normal: validateBreakingFile,
};

/**
 * 1ファイル分の検証（V-02〜V-17・V-23〜V-27）。
 * 参照整合（V-18〜V-22）はデータセット全体を要するため validateReferences で行う。
 */
export function validateFile<K extends CsvKind>(
  kind: K,
  parsed: ParsedCsv,
  fileName: string = CSV_FILE_NAMES[kind],
): FileValidationResult<K> {
  const columnIssues = checkColumns(kind, parsed, fileName);
  if (columnIssues.length > 0) {
    // 必須カラムが無い状態で行を読むと同じ誤りが行数分だけ増えるため、ここで打ち切る
    return { issues: columnIssues, rows: [] as ValidatedGameData[K] };
  }
  const result = FILE_VALIDATORS[kind](parsed, fileName);
  return { issues: result.issues, rows: result.rows as ValidatedGameData[K] };
}

// ---------------------------------------------------------------------------
// 参照整合検証（V-18〜V-22）
// ---------------------------------------------------------------------------

export function validateReferences(data: ValidatedGameData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const goldIds = new Set(data.gold_abilities.map((row) => row.abilityId));
  const blueTypes = new Map<string, AbilityType>();
  for (const row of data.blue_abilities) {
    if (!blueTypes.has(row.abilityId)) blueTypes.set(row.abilityId, row.abilityType);
  }

  const prereqFile = CSV_FILE_NAMES.gold_prerequisites;
  for (const row of data.gold_prerequisites) {
    // V-18
    if (!goldIds.has(row.goldId)) {
      issues.push({
        code: ERROR_CODES.INVALID_CSV,
        file: prereqFile,
        line: row.line,
        column: "gold_id",
        message: `${prereqFile} ${row.line}行目: gold_id「${row.goldId}」が ${CSV_FILE_NAMES.gold_abilities} に存在しません。`,
      });
    }
    // V-19
    const abilityType = blueTypes.get(row.lowerBlueId);
    if (abilityType === undefined) {
      issues.push({
        code: ERROR_CODES.INVALID_CSV,
        file: prereqFile,
        line: row.line,
        column: "lower_blue_id",
        message: `${prereqFile} ${row.line}行目: lower_blue_id「${row.lowerBlueId}」が ${CSV_FILE_NAMES.blue_abilities} に存在しません。`,
      });
      continue;
    }
    // V-20
    const states = statesOf(abilityType);
    if (!states.includes(row.requiredState)) {
      issues.push({
        code: ERROR_CODES.INVALID_CSV,
        file: prereqFile,
        line: row.line,
        column: "required_state",
        message: `${prereqFile} ${row.line}行目: 列 required_state の値「${row.requiredState}」は ${states.join(" / ")} のいずれかである必要があります。`,
      });
    }
  }

  for (const kind of ["base_sense_plus", "base_normal"] as const) {
    const file = CSV_FILE_NAMES[kind];
    for (const row of data[kind]) {
      const defs = data.base_ability_defs.filter(
        (def) =>
          def.abilityId === row.abilityId &&
          (row.playerType === "common" || def.playerType === row.playerType),
      );
      // V-21
      if (defs.length === 0) {
        issues.push({
          code: ERROR_CODES.INVALID_CSV,
          file,
          line: row.line,
          column: "ability_id",
          message: `${file} ${row.line}行目: ability_id「${row.abilityId}」が ${CSV_FILE_NAMES.base_ability_defs} に存在しません。`,
        });
        continue;
      }
      // V-22
      const inRange = defs.some(
        (def) =>
          row.fromValue >= def.minValue &&
          row.fromValue <= def.maxValue &&
          row.toValue >= def.minValue &&
          row.toValue <= def.maxValue,
      );
      if (!inRange) {
        const def = defs[0];
        issues.push({
          code: ERROR_CODES.INVALID_CSV,
          file,
          line: row.line,
          column: "from_value",
          message: `${file} ${row.line}行目: ${row.abilityId} の ${row.fromValue}→${row.toValue} は ${CSV_FILE_NAMES.base_ability_defs} の範囲（${def?.minValue ?? 0}〜${def?.maxValue ?? 0}）を超えています。`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// データセット全体の検証
// ---------------------------------------------------------------------------

export interface DataSetValidationOptions {
  /** CSV_FILE_MISSING メッセージに載せる public/data 配下のディレクトリ名。 */
  directory?: string;
  /**
   * インポートで上書きされた種別（検証済みの行）。
   * 種別単位の全置換であり、標準CSVの同種別行は一切残らない（06_persistence_spec.md §2）。
   */
  overrides?: Partial<ValidatedGameData>;
}

/**
 * ゲームデータ一式の検証。エラーが1件でもあればロード中止（data = null）とする。
 * 最初の1件で打ち切らず全件を収集し、上限を超えた分は件数のみ返す。
 */
export function validateDataSet(
  files: Partial<Record<CsvKind, ParsedCsv>>,
  options: DataSetValidationOptions = {},
): DataSetValidationResult {
  const directory = options.directory ?? "";
  const overrides = options.overrides ?? {};
  const issues: ValidationIssue[] = [];
  const data = emptyGameData();
  const isPresent = (kind: CsvKind): boolean =>
    files[kind] !== undefined || overrides[kind] !== undefined;

  // V-01: 必須ファイル
  const missing: CsvKind[] = REQUIRED_CSV_KINDS.filter((kind) => !isPresent(kind));
  const hasAnyBase = CONDITIONAL_CSV_KINDS.some((kind) => isPresent(kind));
  if (!hasAnyBase) missing.push(...CONDITIONAL_CSV_KINDS);
  for (const kind of missing) {
    const file = CSV_FILE_NAMES[kind];
    issues.push({
      code: ERROR_CODES.CSV_FILE_MISSING,
      file,
      line: null,
      column: null,
      message: `${file} が見つかりません。public/data/${directory}/ を確認してください。`,
    });
  }

  for (const kind of Object.keys(FILE_VALIDATORS) as CsvKind[]) {
    const override = overrides[kind];
    if (override !== undefined) {
      // 上書き分はインポート時に種別単位で検証済み。標準CSVは読まずに丸ごと置き換える
      assignRows(data, kind, override);
      continue;
    }
    const parsed = files[kind];
    if (!parsed) continue;
    const result = validateFile(kind, parsed);
    issues.push(...result.issues);
    assignRows(data, kind, result.rows);
  }

  issues.push(...validateReferences(data));

  const capped = issues.slice(0, MAX_ISSUES);
  return {
    issues: capped,
    omittedCount: Math.max(0, issues.length - capped.length),
    data: issues.length === 0 ? data : null,
  };
}

function assignRows<K extends CsvKind>(
  data: ValidatedGameData,
  kind: K,
  rows: ValidatedGameData[K],
): void {
  data[kind] = rows;
}
