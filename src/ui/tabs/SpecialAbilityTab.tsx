/**
 * 画面3 特殊能力（05_ui_spec.md §5）。
 * 金特の下位青特は「表示上」自動追加し、経験点の重複排除は domain（§8.1）に委ねる。
 * この画面では計算を行わず、store の結果を能力ごとに引き当てて表示する。
 */
import type { GameDataSet } from "@/domain/models/gameData";
import type { BlueTarget, GoldTarget, PlayerPlan } from "@/domain/models/plan";
import type { CalculationIssue, CalculationItem } from "@/domain/models/result";
import { useGameDataStore } from "@/store/useGameDataStore";
import { usePlanStore } from "@/store/usePlanStore";
import { useResultStore } from "@/store/useResultStore";
import type { AbilityKind } from "../components/AbilityPicker";
import { AbilityPicker, FIELDER_ONLY_NOTE, fielderGroupOf } from "../components/AbilityPicker";
import { ExpInline } from "../components/ExpInline";
import { HintLevelSelect } from "../components/HintLevelSelect";
import { SourceBadge } from "../components/SourceBadge";

export const NO_PREREQ_TEXT = "前提: なし";
/**
 * FR-BL-08 の表示。マージ規則（04 §8.1）では「所持済み」として cost 0 に丸められるため、
 * ユーザーが直接下位を指定したことは画面側で明示する。
 */
export const BLUE_INVALID_TARGET_MESSAGE =
  "[INVALID_TARGET] 目標は現在より上位の状態にしてください。";
export const GOLD_LOWER_HINT_LABEL = "下位青特のコツLv";

export interface BlueDisplayRow {
  abilityId: string;
  displayName: string;
  states: string[];
  currentState: string;
  targetState: string;
  hintLevel: number;
  /** ユーザーが明示的に追加した行。false の場合は削除ボタンを出さない（05_ui_spec.md §5.2）。 */
  userSpecified: boolean;
  /** 前提として自動追加した金特の表示名。 */
  autoFromNames: string[];
  fielderOnly: boolean;
}

export interface GoldDisplayRow {
  abilityId: string;
  displayName: string;
  hintLevel: number;
  lowerAbilityHintLevel: number;
  prereqNames: string[];
  fielderOnly: boolean;
}

interface BlueDraft extends BlueDisplayRow {
  order: number | null;
}

/**
 * 選択中の青特一覧（05_ui_spec.md §5.2）。
 * 同一 abilityId は必ず1行へ畳み込み、手動指定と自動追加の二重表示を作らない。
 */
export function buildBlueRows(gameData: GameDataSet, plan: PlayerPlan): BlueDisplayRow[] {
  const drafts = new Map<string, BlueDraft>();

  const describe = (abilityId: string): { displayName: string; states: string[] } => {
    const meta = gameData.blueIndex.get(abilityId);
    return { displayName: meta?.displayName ?? abilityId, states: meta?.states ?? [] };
  };
  const groupOf = (abilityId: string): number =>
    fielderGroupOf(gameData.blueIndex.get(abilityId)?.playerType ?? "common", plan.playerType);
  const advanced = (abilityId: string, a: string, b: string): string => {
    const { states } = describe(abilityId);
    const ia = states.indexOf(a);
    const ib = states.indexOf(b);
    if (ia < 0 || ib < 0) return ia < 0 ? b : a;
    return ib > ia ? b : a;
  };

  plan.blueTargets.forEach((target, index) => {
    if (drafts.has(target.abilityId)) return;
    const { displayName, states } = describe(target.abilityId);
    drafts.set(target.abilityId, {
      abilityId: target.abilityId,
      displayName,
      states,
      currentState: target.currentState,
      targetState: target.targetState,
      hintLevel: target.hintLevel,
      userSpecified: true,
      autoFromNames: [],
      fielderOnly: groupOf(target.abilityId) === 1,
      order: index,
    });
  });

  for (const goldTarget of plan.goldTargets) {
    const goldName = gameData.goldIndex.get(goldTarget.abilityId)?.displayName ?? goldTarget.abilityId;
    for (const prereq of gameData.goldPrereq.get(goldTarget.abilityId) ?? []) {
      const existing = drafts.get(prereq.lowerBlueId);
      if (existing) {
        existing.autoFromNames.push(goldName);
        if (!existing.userSpecified) {
          existing.targetState = advanced(
            prereq.lowerBlueId,
            existing.targetState,
            prereq.requiredState,
          );
          existing.hintLevel = Math.max(existing.hintLevel, goldTarget.lowerAbilityHintLevel);
        }
        continue;
      }
      const { displayName, states } = describe(prereq.lowerBlueId);
      drafts.set(prereq.lowerBlueId, {
        abilityId: prereq.lowerBlueId,
        displayName,
        states,
        currentState: states[0] ?? "NONE",
        targetState: prereq.requiredState,
        hintLevel: goldTarget.lowerAbilityHintLevel,
        userSpecified: false,
        autoFromNames: [goldName],
        fielderOnly: groupOf(prereq.lowerBlueId) === 1,
        order: null,
      });
    }
  }

  return [...drafts.values()]
    .sort((a, b) => {
      if (a.fielderOnly !== b.fielderOnly) return a.fielderOnly ? 1 : -1;
      if (a.userSpecified !== b.userSpecified) return a.userSpecified ? -1 : 1;
      if (a.order !== null && b.order !== null) return a.order - b.order;
      return a.abilityId < b.abilityId ? -1 : a.abilityId > b.abilityId ? 1 : 0;
    })
    .map((draft) => {
      const { order, ...row } = draft;
      void order;
      return row;
    });
}

/** 選択中の金特一覧（05_ui_spec.md §5.3）。 */
export function buildGoldRows(gameData: GameDataSet, plan: PlayerPlan): GoldDisplayRow[] {
  return plan.goldTargets
    .map((target, index) => {
      const meta = gameData.goldIndex.get(target.abilityId);
      return {
        row: {
          abilityId: target.abilityId,
          displayName: meta?.displayName ?? target.abilityId,
          hintLevel: target.hintLevel,
          lowerAbilityHintLevel: target.lowerAbilityHintLevel,
          prereqNames: (gameData.goldPrereq.get(target.abilityId) ?? []).map(
            (prereq) =>
              gameData.blueIndex.get(prereq.lowerBlueId)?.displayName ?? prereq.lowerBlueId,
          ),
          fielderOnly: fielderGroupOf(meta?.playerType ?? "common", plan.playerType) === 1,
        },
        order: index,
      };
    })
    .sort((a, b) => {
      if (a.row.fielderOnly !== b.row.fielderOnly) return a.row.fielderOnly ? 1 : -1;
      return a.order - b.order;
    })
    .map((wrapped) => wrapped.row);
}

function ExpCell({
  item,
  issues,
  testId,
}: {
  item: CalculationItem | undefined;
  issues: CalculationIssue[];
  testId: string;
}): JSX.Element {
  if (issues.length > 0) {
    return (
      <span className="cell-error" data-testid={testId}>
        {issues.map((issue) => issue.message).join(" / ")}
      </span>
    );
  }
  if (!item) {
    return <span data-testid={testId}>—</span>;
  }
  return <ExpInline vector={item.cost} testId={testId} />;
}

export function SpecialAbilityTab(): JSX.Element {
  const gameData = useGameDataStore((state) => state.gameData);
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const result = useResultStore((state) => state.result);

  if (!gameData || !plan) {
    return (
      <section className="tab-panel" data-testid="special-tab">
        <h2>特殊能力</h2>
        <p data-testid="special-loading">データを準備しています…</p>
      </section>
    );
  }

  const blueRows = buildBlueRows(gameData, plan);
  const goldRows = buildGoldRows(gameData, plan);
  const issuesOf = (category: "blue" | "gold", abilityId: string): CalculationIssue[] =>
    result?.issues.filter(
      (issue) => issue.category === category && issue.targetId === abilityId,
    ) ?? [];

  function handleAdd(kind: AbilityKind, abilityId: string): void {
    if (!plan || !gameData) return;
    if (kind === "blue") {
      const states = gameData.blueIndex.get(abilityId)?.states ?? [];
      const next: BlueTarget = {
        abilityId,
        currentState: states[0] ?? "NONE",
        targetState: states[states.length - 1] ?? "ON",
        hintLevel: 0,
      };
      updatePlan({ blueTargets: [...plan.blueTargets, next] });
      return;
    }
    const next: GoldTarget = { abilityId, hintLevel: 0, lowerAbilityHintLevel: 0 };
    updatePlan({ goldTargets: [...plan.goldTargets, next] });
  }

  /** 自動追加行を編集した場合はユーザー指定へ昇格させる（05_ui_spec.md §5.2）。 */
  function patchBlue(row: BlueDisplayRow, patch: Partial<BlueTarget>): void {
    if (!plan) return;
    const next: BlueTarget = {
      abilityId: row.abilityId,
      currentState: row.currentState,
      targetState: row.targetState,
      hintLevel: row.hintLevel,
      ...patch,
    };
    const index = plan.blueTargets.findIndex((target) => target.abilityId === row.abilityId);
    const blueTargets =
      index >= 0
        ? plan.blueTargets.map((target, i) => (i === index ? next : target))
        : [...plan.blueTargets, next];
    updatePlan({ blueTargets });
  }

  function removeBlue(abilityId: string): void {
    if (!plan) return;
    updatePlan({
      blueTargets: plan.blueTargets.filter((target) => target.abilityId !== abilityId),
    });
  }

  function patchGold(abilityId: string, patch: Partial<GoldTarget>): void {
    if (!plan) return;
    updatePlan({
      goldTargets: plan.goldTargets.map((target) =>
        target.abilityId === abilityId ? { ...target, ...patch } : target,
      ),
    });
  }

  function removeGold(abilityId: string): void {
    if (!plan) return;
    updatePlan({
      goldTargets: plan.goldTargets.filter((target) => target.abilityId !== abilityId),
    });
  }

  return (
    <section className="tab-panel" data-testid="special-tab">
      <h2>特殊能力</h2>

      <AbilityPicker
        gameData={gameData}
        planType={plan.playerType}
        selectedBlueIds={new Set(plan.blueTargets.map((target) => target.abilityId))}
        selectedGoldIds={new Set(plan.goldTargets.map((target) => target.abilityId))}
        onAdd={handleAdd}
      />

      <section className="selected-list" data-testid="selected-blue-list">
        <h3>選択中の青特殊能力</h3>
        {blueRows.length === 0 && <p className="field-note">まだ追加されていません。</p>}
        <ul>
          {blueRows.map((row) => {
            const currentIndex = row.states.indexOf(row.currentState);
            const targetIndex = row.states.indexOf(row.targetState);
            const invalidTarget =
              currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex;
            return (
            <li key={row.abilityId} data-testid={`blue-row-${row.abilityId}`}>
              <span data-testid={`blue-name-${row.abilityId}`}>
                {row.displayName}
                {row.fielderOnly ? FIELDER_ONLY_NOTE : ""}
              </span>
              <select
                aria-label={`${row.displayName} の現在`}
                data-testid={`blue-current-${row.abilityId}`}
                value={row.currentState}
                onChange={(event) => {
                  patchBlue(row, { currentState: event.target.value });
                }}
              >
                {row.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${row.displayName} の目標`}
                data-testid={`blue-target-${row.abilityId}`}
                className={invalidTarget ? "input-error" : undefined}
                aria-invalid={invalidTarget}
                value={row.targetState}
                onChange={(event) => {
                  patchBlue(row, { targetState: event.target.value });
                }}
              >
                {row.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <HintLevelSelect
                label={`${row.displayName} のコツLv`}
                testId={`blue-hint-${row.abilityId}`}
                value={row.hintLevel}
                onChange={(hintLevel) => {
                  patchBlue(row, { hintLevel });
                }}
              />
              {row.userSpecified && (
                <button
                  type="button"
                  data-testid={`blue-remove-${row.abilityId}`}
                  onClick={() => {
                    removeBlue(row.abilityId);
                  }}
                >
                  削除
                </button>
              )}
              {row.autoFromNames.length > 0 && (
                <p className="auto-note" data-testid={`blue-auto-note-${row.abilityId}`}>
                  🔗 {row.autoFromNames.join("・")}の前提
                  {row.userSpecified
                    ? `でもあります（コツLvはユーザー指定の Lv${row.hintLevel} を使います）`
                    : "として自動追加"}
                </p>
              )}
              <ExpCell
                item={result?.blue.find((entry) => entry.id === row.abilityId)}
                issues={
                  invalidTarget
                    ? [
                        {
                          code: "INVALID_TARGET",
                          category: "blue",
                          targetId: row.abilityId,
                          message: BLUE_INVALID_TARGET_MESSAGE,
                        },
                      ]
                    : issuesOf("blue", row.abilityId)
                }
                testId={`blue-exp-${row.abilityId}`}
              />
            </li>
            );
          })}
        </ul>
      </section>

      <section className="selected-list" data-testid="selected-gold-list">
        <h3>選択中の金特殊能力</h3>
        {goldRows.length === 0 && <p className="field-note">まだ追加されていません。</p>}
        <ul>
          {goldRows.map((row) => {
            const item = result?.gold.find((entry) => entry.id === row.abilityId);
            return (
              <li key={row.abilityId} data-testid={`gold-row-${row.abilityId}`}>
                <span data-testid={`gold-name-${row.abilityId}`}>
                  {row.displayName}
                  {row.fielderOnly ? FIELDER_ONLY_NOTE : ""}
                </span>
                <HintLevelSelect
                  label={`${row.displayName} のコツLv`}
                  testId={`gold-hint-${row.abilityId}`}
                  value={row.hintLevel}
                  onChange={(hintLevel) => {
                    patchGold(row.abilityId, { hintLevel });
                  }}
                />
                {row.prereqNames.length > 0 && (
                  <>
                    <span>{GOLD_LOWER_HINT_LABEL}</span>
                    <HintLevelSelect
                      label={`${row.displayName} の${GOLD_LOWER_HINT_LABEL}`}
                      testId={`gold-lower-hint-${row.abilityId}`}
                      value={row.lowerAbilityHintLevel}
                      onChange={(lowerAbilityHintLevel) => {
                        patchGold(row.abilityId, { lowerAbilityHintLevel });
                      }}
                    />
                  </>
                )}
                <button
                  type="button"
                  data-testid={`gold-remove-${row.abilityId}`}
                  onClick={() => {
                    removeGold(row.abilityId);
                  }}
                >
                  削除
                </button>
                <p className="prereq-note" data-testid={`gold-prereq-${row.abilityId}`}>
                  {row.prereqNames.length === 0
                    ? NO_PREREQ_TEXT
                    : `前提: ${row.prereqNames.join(" / ")}`}
                </p>
                <ExpCell
                  item={item}
                  issues={issuesOf("gold", row.abilityId)}
                  testId={`gold-exp-${row.abilityId}`}
                />
                {item && <SourceBadge source={item.source} testId={`gold-source-${row.abilityId}`} />}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
