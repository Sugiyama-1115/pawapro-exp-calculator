/**
 * 画面4 変化球（05_ui_spec.md §6）。野手プランではタブごと非表示にする（FR-BR-08）。
 * 経験点の推定は行わない。データが無ければ空欄のままにし、0 を入れない（FR-BR-05）。
 */
import { useState } from "react";
import { breakingKey } from "@/domain/keys";
import type { BreakingCacheRow } from "@/domain/models/ability";
import type { ExpKey, ExpVector } from "@/domain/models/expVector";
import { EXP_KEYS } from "@/domain/models/expVector";
import type { BreakingPlan, BreakingStep } from "@/domain/models/plan";
import type { CalculationIssue } from "@/domain/models/result";
import {
  BREAKING_LEVEL_MAX,
  BREAKING_LEVEL_MIN,
  PITCH_COUNT_MAX,
  TOTAL_BREAK_MAX,
  useGameDataStore,
} from "@/store/useGameDataStore";
import { usePlanStore } from "@/store/usePlanStore";
import { useResultStore } from "@/store/useResultStore";
import { clampInt, formatNumber, parseIntegerInput } from "@/utils/number";
import { EXP_LABELS } from "../components/ExpVectorTable";
import { SourceBadge } from "../components/SourceBadge";

export const NOT_MEASURED_TITLE = "この変化球構成は未計測です。";
export const NOT_MEASURED_BODY =
  "ゲーム画面に表示された必要経験点を入力してください。";
export const STEP_UNREGISTERED_TEXT = "未登録 → 入力してください";
export const CACHE_OVERWRITE_CONFIRM =
  "同じキーの実測値が既に登録されています。上書きしますか？";
export const CACHE_REGISTER_EMPTY = "経験点を入力済みのステップがありません。";
export const CACHE_REGISTER_DONE = "共通キャッシュへ登録しました。";
/** 経験点欄が1つでも空なら未入力として扱う（05_ui_spec.md §6.1）。 */
export const AGGREGATE_INCOMPLETE_NOTE = "5項目すべてを入力すると計上されます。";

const EMPTY_BREAKING_PLAN: BreakingPlan = {
  composition: [],
  mode: "none",
  aggregate: null,
  steps: [],
};

type ExpDraft = Record<ExpKey, string>;

function toDraft(vector: ExpVector | null): ExpDraft {
  const draft = {} as ExpDraft;
  for (const key of EXP_KEYS) draft[key] = vector === null ? "" : String(vector[key]);
  return draft;
}

/** 5項目すべてが 0 以上の整数のときだけベクトルを確定させる。 */
function toVector(draft: ExpDraft): ExpVector | null {
  const vector = {} as ExpVector;
  for (const key of EXP_KEYS) {
    const parsed = parseIntegerInput(draft[key]);
    if (parsed === null || parsed < 0) return null;
    vector[key] = parsed;
  }
  return vector;
}

interface NumberFieldProps {
  label: string;
  testId?: string;
  value: number;
  min: number;
  max: number;
  onCommit(value: number): void;
}

/** 入力途中は文字列で保持し、読めない値のまま確定した場合は直前の値へ戻す（05_ui_spec.md §9）。 */
function NumberField({ label, testId, value, min, max, onCommit }: NumberFieldProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      data-testid={testId}
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseIntegerInput(text);
        if (parsed !== null) onCommit(clampInt(parsed, min, max));
      }}
      onBlur={() => {
        setDraft(null);
      }}
    />
  );
}

interface AggregateInputsProps {
  aggregate: ExpVector | null;
  onChange(value: ExpVector | null): void;
}

function AggregateInputs({ aggregate, onChange }: AggregateInputsProps): JSX.Element {
  const [draft, setDraft] = useState<ExpDraft>(() => toDraft(aggregate));

  function handleChange(key: ExpKey, text: string): void {
    const next: ExpDraft = { ...draft, [key]: text };
    setDraft(next);
    onChange(toVector(next));
  }

  return (
    <div className="breaking-aggregate" data-testid="breaking-aggregate">
      {EXP_KEYS.map((key) => (
        <label key={key} htmlFor={`breaking-aggregate-input-${key}`}>
          {EXP_LABELS[key]}
          <input
            id={`breaking-aggregate-input-${key}`}
            type="number"
            inputMode="numeric"
            min={0}
            data-testid={`breaking-aggregate-${key}`}
            value={draft[key]}
            onChange={(event) => {
              handleChange(key, event.target.value);
            }}
          />
        </label>
      ))}
      {toVector(draft) === null && (
        <p className="field-note" data-testid="breaking-aggregate-note">
          {AGGREGATE_INCOMPLETE_NOTE}
        </p>
      )}
    </div>
  );
}

interface StepRowProps {
  step: BreakingStep;
  /** 4キー完全一致で見つかった共通キャッシュの値。無ければ null。 */
  cached: ExpVector | null;
  issues: CalculationIssue[];
  pitchTypeListId: string;
  onPatch(patch: Partial<BreakingStep>): void;
  onRemove(): void;
}

function StepRow({
  step,
  cached,
  issues,
  pitchTypeListId,
  onPatch,
  onRemove,
}: StepRowProps): JSX.Element {
  const [draft, setDraft] = useState<ExpDraft | null>(null);
  // 手入力 > キャッシュ自動入力 の順で表示する（05_ui_spec.md §6.2）
  const shown = draft ?? toDraft(step.cost ?? cached);
  const label = `ステップ${step.seq}`;

  function handleCost(key: ExpKey, text: string): void {
    const next: ExpDraft = { ...shown, [key]: text };
    setDraft(next);
    // 5項目が揃った時点で手動値として確定する。揃わない間はキャッシュ解決に委ねる
    onPatch({ cost: toVector(next) });
  }

  return (
    <tr data-testid={`breaking-step-${step.seq}`}>
      <td>{step.seq}</td>
      <td>
        <input
          type="text"
          aria-label={`${label} の球種`}
          data-testid={`breaking-step-pitch-${step.seq}`}
          list={pitchTypeListId}
          value={step.pitchType}
          onChange={(event) => {
            onPatch({ pitchType: event.target.value });
          }}
        />
      </td>
      <td>
        <NumberField
          label={`${label} の前の変化量`}
          testId={`breaking-step-from-${step.seq}`}
          value={step.fromLevel}
          min={BREAKING_LEVEL_MIN}
          max={BREAKING_LEVEL_MAX - 1}
          onCommit={(fromLevel) => {
            // 後（toLevel）は常に 前 + 1（05_ui_spec.md §6.2）
            onPatch({ fromLevel, toLevel: fromLevel + 1 });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          aria-label={`${label} の後の変化量`}
          data-testid={`breaking-step-to-${step.seq}`}
          value={step.toLevel}
          readOnly
          disabled
        />
      </td>
      <td>
        <NumberField
          label={`${label} の前総変化量`}
          testId={`breaking-step-total-${step.seq}`}
          value={step.totalBreakBefore}
          min={0}
          max={TOTAL_BREAK_MAX}
          onCommit={(totalBreakBefore) => {
            onPatch({ totalBreakBefore });
          }}
        />
      </td>
      <td>
        <NumberField
          label={`${label} の前球種数`}
          testId={`breaking-step-count-${step.seq}`}
          value={step.pitchCountBefore}
          min={0}
          max={PITCH_COUNT_MAX}
          onCommit={(pitchCountBefore) => {
            onPatch({ pitchCountBefore });
          }}
        />
      </td>
      <td>
        <div className="breaking-step-cost">
          {EXP_KEYS.map((key) => (
            <label key={key} htmlFor={`breaking-step-cost-${step.seq}-${key}`}>
              {EXP_LABELS[key]}
              <input
                id={`breaking-step-cost-${step.seq}-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                data-testid={`breaking-step-cost-${step.seq}-${key}`}
                value={shown[key]}
                onChange={(event) => {
                  handleCost(key, event.target.value);
                }}
              />
            </label>
          ))}
        </div>
        {issues.length > 0 && (
          <p className="cell-error" data-testid={`breaking-step-issue-${step.seq}`}>
            ⚠ {STEP_UNREGISTERED_TEXT}
          </p>
        )}
      </td>
      <td>
        {step.cost !== null ? (
          <SourceBadge source="manual" testId={`breaking-step-source-${step.seq}`} />
        ) : cached !== null ? (
          <SourceBadge source="measured" testId={`breaking-step-source-${step.seq}`} />
        ) : (
          <span data-testid={`breaking-step-source-${step.seq}`}>—</span>
        )}
      </td>
      <td>
        <button
          type="button"
          data-testid={`breaking-step-remove-${step.seq}`}
          onClick={onRemove}
        >
          削除
        </button>
      </td>
    </tr>
  );
}

export function BreakingBallTab(): JSX.Element {
  const gameData = useGameDataStore((state) => state.gameData);
  const registerBreakingCache = useGameDataStore((state) => state.registerBreakingCache);
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const result = useResultStore((state) => state.result);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  if (!gameData || !plan) {
    return (
      <section className="tab-panel" data-testid="breaking-tab">
        <h2>変化球</h2>
        <p data-testid="breaking-loading">データを準備しています…</p>
      </section>
    );
  }

  const breaking = plan.breakingPlan ?? EMPTY_BREAKING_PLAN;
  const senseMode = plan.senseMode;
  const cache = senseMode === "sense_plus" ? gameData.breakingSensePlus : gameData.breakingNormal;

  function patch(next: Partial<BreakingPlan>): void {
    updatePlan({ breakingPlan: { ...breaking, ...next } });
  }

  function patchStep(seq: number, stepPatch: Partial<BreakingStep>): void {
    patch({
      steps: breaking.steps.map((step) => (step.seq === seq ? { ...step, ...stepPatch } : step)),
    });
  }

  const totalLevel = breaking.composition.reduce((sum, entry) => sum + entry.level, 0);
  const issuesOf = (targetId: string): CalculationIssue[] =>
    result?.issues.filter(
      (issue) => issue.category === "breaking" && issue.targetId === targetId,
    ) ?? [];

  // 候補は CSV に出現する球種と入力済みの値から作る。コードに固定リストを持たない（03_data_spec.md §10）
  const pitchTypeOptions = [
    ...new Set([
      ...[...cache.values()].map((row) => row.pitchType),
      ...breaking.composition.map((entry) => entry.pitchType),
      ...breaking.steps.map((step) => step.pitchType),
    ]),
  ]
    .filter((value) => value !== "")
    .sort();
  const pitchTypeListId = "breaking-pitch-type-options";

  function cachedCostOf(step: BreakingStep): ExpVector | null {
    return (
      cache.get(
        breakingKey(step.pitchType, step.fromLevel, step.totalBreakBefore, step.pitchCountBefore),
      )?.cost ?? null
    );
  }

  function handleRegisterCache(): void {
    const rows = breaking.steps.flatMap<BreakingCacheRow>((step) =>
      step.cost === null || step.pitchType === ""
        ? []
        : [
            {
              pitchType: step.pitchType,
              fromLevel: step.fromLevel,
              toLevel: step.toLevel,
              totalBreakBefore: step.totalBreakBefore,
              pitchCountBefore: step.pitchCountBefore,
              cost: step.cost,
            },
          ],
    );
    if (rows.length === 0) {
      setCacheMessage(CACHE_REGISTER_EMPTY);
      return;
    }
    const duplicated = rows.some((row) =>
      cache.has(
        breakingKey(row.pitchType, row.fromLevel, row.totalBreakBefore, row.pitchCountBefore),
      ),
    );
    if (duplicated && !window.confirm(CACHE_OVERWRITE_CONFIRM)) return;
    void registerBreakingCache(senseMode, rows);
    setCacheMessage(`${CACHE_REGISTER_DONE}（${formatNumber(rows.length)}件）`);
  }

  return (
    <section className="tab-panel" data-testid="breaking-tab">
      <h2>変化球</h2>

      <datalist id={pitchTypeListId}>
        {pitchTypeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <section className="breaking-composition" data-testid="breaking-composition">
        <h3>目標変化球構成</h3>
        <ul>
          {breaking.composition.map((entry, index) => (
            <li key={index} data-testid={`breaking-composition-${index}`}>
              <input
                type="text"
                aria-label={`球種${index + 1}`}
                data-testid={`breaking-composition-pitch-${index}`}
                list={pitchTypeListId}
                value={entry.pitchType}
                onChange={(event) => {
                  patch({
                    composition: breaking.composition.map((item, i) =>
                      i === index ? { ...item, pitchType: event.target.value } : item,
                    ),
                  });
                }}
              />
              <label htmlFor={`breaking-composition-level-input-${index}`}>変化量</label>
              <select
                id={`breaking-composition-level-input-${index}`}
                data-testid={`breaking-composition-level-${index}`}
                value={entry.level}
                onChange={(event) => {
                  const level = Number.parseInt(event.target.value, 10);
                  patch({
                    composition: breaking.composition.map((item, i) =>
                      i === index ? { ...item, level } : item,
                    ),
                  });
                }}
              >
                {Array.from(
                  { length: BREAKING_LEVEL_MAX - BREAKING_LEVEL_MIN },
                  (_, offset) => BREAKING_LEVEL_MIN + 1 + offset,
                ).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid={`breaking-composition-remove-${index}`}
                onClick={() => {
                  patch({ composition: breaking.composition.filter((_, i) => i !== index) });
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-testid="breaking-composition-add"
          onClick={() => {
            patch({
              composition: [
                ...breaking.composition,
                { pitchType: "", level: BREAKING_LEVEL_MIN + 1 },
              ],
            });
          }}
        >
          + 球種を追加
        </button>
        <span className="breaking-summary">
          総変化量: <span data-testid="breaking-total-level">{formatNumber(totalLevel)}</span> /
          球種数:{" "}
          <span data-testid="breaking-pitch-count">
            {formatNumber(breaking.composition.length)}
          </span>
        </span>
      </section>

      <fieldset className="breaking-mode" data-testid="breaking-mode">
        <legend>必要経験点の入力方式</legend>
        <label htmlFor="breaking-mode-aggregate-input">
          <input
            id="breaking-mode-aggregate-input"
            type="radio"
            name="breaking-mode"
            data-testid="breaking-mode-aggregate"
            checked={breaking.mode === "aggregate"}
            onChange={() => {
              patch({ mode: "aggregate" });
            }}
          />
          一括で入力する
        </label>
        <label htmlFor="breaking-mode-step-input">
          <input
            id="breaking-mode-step-input"
            type="radio"
            name="breaking-mode"
            data-testid="breaking-mode-step"
            checked={breaking.mode === "step"}
            onChange={() => {
              patch({ mode: "step" });
            }}
          />
          ステップごとに入力する
        </label>
        <label htmlFor="breaking-mode-none-input">
          <input
            id="breaking-mode-none-input"
            type="radio"
            name="breaking-mode"
            data-testid="breaking-mode-none"
            checked={breaking.mode === "none"}
            onChange={() => {
              patch({ mode: "none" });
            }}
          />
          未入力
        </label>
      </fieldset>

      {breaking.mode === "none" && (
        <div className="issue-panel" role="alert" data-testid="breaking-not-measured">
          <p className="issue-panel-title">⚠ {NOT_MEASURED_TITLE}</p>
          <p>{NOT_MEASURED_BODY}</p>
          <button
            type="button"
            data-testid="breaking-start-aggregate"
            onClick={() => {
              patch({ mode: "aggregate" });
            }}
          >
            一括経験点を入力
          </button>
          <button
            type="button"
            data-testid="breaking-start-step"
            onClick={() => {
              patch({ mode: "step" });
            }}
          >
            ステップごとに入力
          </button>
        </div>
      )}

      {breaking.mode === "aggregate" && (
        <section className="breaking-aggregate-section">
          <h3>一括入力</h3>
          <AggregateInputs
            key={plan.id}
            aggregate={breaking.aggregate}
            onChange={(aggregate) => {
              patch({ aggregate });
            }}
          />
        </section>
      )}

      {breaking.mode === "step" && (
        <section className="breaking-step-section">
          <h3>ステップ入力</h3>
          <table className="breaking-step-table">
            <thead>
              <tr>
                <th scope="col">seq</th>
                <th scope="col">球種</th>
                <th scope="col">前</th>
                <th scope="col">後</th>
                <th scope="col">前総変化</th>
                <th scope="col">前球種数</th>
                <th scope="col">経験点</th>
                <th scope="col">出どころ</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {breaking.steps.map((step) => (
                <StepRow
                  key={step.seq}
                  step={step}
                  cached={cachedCostOf(step)}
                  issues={issuesOf(String(step.seq))}
                  pitchTypeListId={pitchTypeListId}
                  onPatch={(stepPatch) => {
                    patchStep(step.seq, stepPatch);
                  }}
                  onRemove={() => {
                    patch({ steps: breaking.steps.filter((entry) => entry.seq !== step.seq) });
                  }}
                />
              ))}
            </tbody>
          </table>
          <button
            type="button"
            data-testid="breaking-step-add"
            onClick={() => {
              const seq = breaking.steps.reduce((max, step) => Math.max(max, step.seq), 0) + 1;
              patch({
                steps: [
                  ...breaking.steps,
                  {
                    seq,
                    pitchType: breaking.composition[0]?.pitchType ?? "",
                    fromLevel: BREAKING_LEVEL_MIN,
                    toLevel: BREAKING_LEVEL_MIN + 1,
                    totalBreakBefore: 0,
                    pitchCountBefore: 0,
                    cost: null,
                  },
                ],
              });
            }}
          >
            + ステップを追加
          </button>
          <button type="button" data-testid="breaking-cache-register" onClick={handleRegisterCache}>
            入力済みステップを共通キャッシュへ登録
          </button>
          {cacheMessage !== null && (
            <p className="field-note" data-testid="breaking-cache-message">
              {cacheMessage}
            </p>
          )}
        </section>
      )}

      {issuesOf("aggregate")
        .concat(issuesOf("composition"), issuesOf("steps"))
        .map((issue, index) => (
          <p className="cell-error" key={index} data-testid={`breaking-issue-${index}`}>
            ⚠ [{issue.code}] {issue.message}
          </p>
        ))}
    </section>
  );
}
