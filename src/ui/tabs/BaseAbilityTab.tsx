/**
 * 画面2 基礎能力（05_ui_spec.md §4）。
 * 能力項目は `base_ability_defs.csv` から生成し、コードに能力名・段数を書かない。
 * 計算は store 経由の結果を表示するだけで、この画面では一切行わない。
 */
import { useState } from "react";
import type { BaseAbilityDef } from "@/domain/models/ability";
import { totalOf, zeroVector } from "@/domain/models/expVector";
import type { CalculationIssue, CalculationItem } from "@/domain/models/result";
import { useGameDataStore } from "@/store/useGameDataStore";
import { usePlanStore } from "@/store/usePlanStore";
import { useResultStore } from "@/store/useResultStore";
import { clampInt, parseIntegerInput } from "@/utils/number";
import { ExpInline } from "../components/ExpInline";
import { ExpVectorTable } from "../components/ExpVectorTable";

export const TARGET_BELOW_CURRENT_MESSAGE = "目標値は初期値以上にしてください。";
export const FIELDER_SECTION_LABEL = "野手能力も入力する";
/** 目標=初期などで必要経験点が発生しない場合の表示（05_ui_spec.md §4）。 */
export const NO_COST_TEXT = "—";

type BaseField = "currentBase" | "targetBase";

interface ValueInputProps {
  def: BaseAbilityDef;
  field: BaseField;
  value: number | undefined;
  invalid: boolean;
  onCommit(value: number | null): void;
}

/**
 * 数値入力（05_ui_spec.md §4・§9）。
 * 入力途中は文字列のまま保持し、確定時に `[min_value, max_value]` へクランプする。
 * 空・非整数のまま確定した場合は直前の有効値に戻す（UI-T2-09）。
 */
function ValueInput({ def, field, value, invalid, onCommit }: ValueInputProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const testId = `base-${field === "currentBase" ? "current" : "target"}-${def.abilityId}`;
  const label = `${def.displayName} の${field === "currentBase" ? "初期値" : "目標値"}`;

  if (def.valueType === "trajectory") {
    const options: number[] = [];
    for (let v = def.minValue; v <= def.maxValue; v++) options.push(v);
    return (
      <select
        aria-label={label}
        data-testid={testId}
        value={value === undefined ? "" : String(value)}
        onChange={(event) => {
          const text = event.target.value;
          onCommit(text === "" ? null : Number.parseInt(text, 10));
        }}
      >
        <option value="">{NO_COST_TEXT}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      data-testid={testId}
      className={invalid ? "input-error" : undefined}
      aria-invalid={invalid}
      min={def.minValue}
      max={def.maxValue}
      value={draft ?? (value === undefined ? "" : String(value))}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseIntegerInput(text);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={() => {
        if (draft !== null) {
          const parsed = parseIntegerInput(draft);
          // 読めない値は採用せず、直前の有効値のまま残す
          if (parsed !== null) onCommit(clampInt(parsed, def.minValue, def.maxValue));
        }
        setDraft(null);
      }}
    />
  );
}

interface BaseAbilityRowProps {
  def: BaseAbilityDef;
  currentValue: number | undefined;
  targetValue: number | undefined;
  item: CalculationItem | undefined;
  issues: CalculationIssue[];
  onCommit(field: BaseField, value: number | null): void;
}

function BaseAbilityRow({
  def,
  currentValue,
  targetValue,
  item,
  issues,
  onCommit,
}: BaseAbilityRowProps): JSX.Element {
  const belowCurrent =
    currentValue !== undefined && targetValue !== undefined && targetValue < currentValue;
  const hasIssue = issues.length > 0;

  return (
    <tr className={hasIssue ? "row-error" : undefined} data-testid={`base-row-${def.abilityId}`}>
      <th scope="row">{def.displayName}</th>
      <td>
        <ValueInput
          def={def}
          field="currentBase"
          value={currentValue}
          invalid={false}
          onCommit={(value) => {
            onCommit("currentBase", value);
          }}
        />
      </td>
      <td>
        <ValueInput
          def={def}
          field="targetBase"
          value={targetValue}
          invalid={belowCurrent}
          onCommit={(value) => {
            onCommit("targetBase", value);
          }}
        />
        {belowCurrent && (
          <p className="field-error" data-testid={`base-target-error-${def.abilityId}`}>
            {TARGET_BELOW_CURRENT_MESSAGE}
          </p>
        )}
      </td>
      <td>
        {hasIssue ? (
          <span className="cell-error" data-testid={`base-exp-${def.abilityId}`}>
            {issues.map((issue) => `⚠ ${issue.message}`).join(" / ")}
          </span>
        ) : item && totalOf(item.cost) > 0 ? (
          <ExpInline vector={item.cost} testId={`base-exp-${def.abilityId}`} />
        ) : (
          <span data-testid={`base-exp-${def.abilityId}`}>{NO_COST_TEXT}</span>
        )}
      </td>
    </tr>
  );
}

export function BaseAbilityTab(): JSX.Element {
  const gameData = useGameDataStore((state) => state.gameData);
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const result = useResultStore((state) => state.result);

  if (!gameData || !plan) {
    return (
      <section className="tab-panel" data-testid="base-tab">
        <h2>基礎能力</h2>
        <p data-testid="base-loading">データを準備しています…</p>
      </section>
    );
  }

  function commit(field: BaseField, abilityId: string, value: number | null): void {
    if (!plan) return;
    const next = { ...plan[field] };
    if (value === null) {
      delete next[abilityId];
    } else {
      next[abilityId] = value;
    }
    updatePlan(field === "currentBase" ? { currentBase: next } : { targetBase: next });
  }

  function renderRows(defs: BaseAbilityDef[]): JSX.Element[] {
    return defs.map((def) => (
      <BaseAbilityRow
        key={def.abilityId}
        def={def}
        currentValue={plan?.currentBase[def.abilityId]}
        targetValue={plan?.targetBase[def.abilityId]}
        item={result?.base.find((entry) => entry.id === def.abilityId)}
        issues={
          result?.issues.filter(
            (issue) => issue.category === "base" && issue.targetId === def.abilityId,
          ) ?? []
        }
        onCommit={(field, value) => {
          commit(field, def.abilityId, value);
        }}
      />
    ));
  }

  // display_order 昇順は baseDefList が保証する（04_calculation_spec.md §8.3）
  const ownDefs = gameData.baseDefList.filter((def) => def.playerType === plan.playerType);
  const fielderDefs =
    plan.playerType === "pitcher"
      ? gameData.baseDefList.filter((def) => def.playerType === "fielder")
      : [];

  return (
    <section className="tab-panel" data-testid="base-tab">
      <h2>基礎能力</h2>

      <table className="ability-table" data-testid="base-table">
        <thead>
          <tr>
            <th scope="col">能力</th>
            <th scope="col">初期値</th>
            <th scope="col">目標値</th>
            <th scope="col">必要経験点</th>
          </tr>
        </thead>
        <tbody>{renderRows(ownDefs)}</tbody>
        <tfoot>
          <tr data-testid="base-subtotal-row">
            <th scope="row" colSpan={3}>
              小計（基礎能力）
            </th>
            <td>
              <ExpVectorTable
                vector={result?.subtotal.base ?? zeroVector()}
                testIdPrefix="base-subtotal"
              />
            </td>
          </tr>
        </tfoot>
      </table>

      {fielderDefs.length > 0 && (
        <details className="fielder-section" data-testid="base-fielder-section">
          <summary>{FIELDER_SECTION_LABEL}</summary>
          <table className="ability-table" data-testid="base-table-fielder">
            <thead>
              <tr>
                <th scope="col">能力</th>
                <th scope="col">初期値</th>
                <th scope="col">目標値</th>
                <th scope="col">必要経験点</th>
              </tr>
            </thead>
            <tbody>{renderRows(fielderDefs)}</tbody>
          </table>
        </details>
      )}
    </section>
  );
}
