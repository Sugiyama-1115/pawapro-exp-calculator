/**
 * 画面1 選手設定（05_ui_spec.md §3）。
 * ゲーム選択はヘッダーの `game-select` に集約し、本タブでは現在のゲームと読み込み状態を示す。
 */
import { useState } from "react";
import { describeRowCounts, selectCurrentGame, useGameDataStore } from "@/store/useGameDataStore";
import { isValidPlanName, PLAN_NAME_MAX_LENGTH, usePlanStore } from "@/store/usePlanStore";
import { CsvImportPanel } from "../components/CsvImportPanel";
import { IssuePanel } from "../components/IssuePanel";

export const PLAN_NAME_ERROR = "選手名を1〜50文字で入力してください。";
export const PLAYER_TYPE_CONFIRM =
  "選手種別を変更すると、基礎能力・特殊能力・変化球の入力内容がクリアされます。続行しますか？";

export function PlanSettingTab(): JSX.Element {
  const status = useGameDataStore((state) => state.status);
  const gameData = useGameDataStore((state) => state.gameData);
  const loadError = useGameDataStore((state) => state.loadError);
  const game = useGameDataStore((state) => selectCurrentGame(state));

  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const changePlayerType = usePlanStore((state) => state.changePlayerType);

  const [nameTouched, setNameTouched] = useState(false);

  if (!plan) {
    return <p data-testid="plan-setting-loading">プランを準備しています…</p>;
  }

  const nameInvalid = nameTouched && !isValidPlanName(plan.name);

  function handlePlayerType(playerType: "pitcher" | "fielder"): void {
    if (!plan || plan.playerType === playerType) return;
    if (!window.confirm(PLAYER_TYPE_CONFIRM)) return;
    changePlayerType(playerType);
  }

  return (
    <section className="tab-panel" data-testid="plan-setting-tab">
      <h2>選手設定</h2>

      <div className="field-grid">
        <div className="field">
          <span className="field-label">ゲーム</span>
          <span data-testid="plan-game-name">{game?.displayName ?? "—"}</span>
          <p className="field-note">ゲームの変更はヘッダーの「ゲーム」から行います。</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="plan-name-input">
            選手名
          </label>
          <input
            id="plan-name-input"
            type="text"
            data-testid="plan-name"
            className={nameInvalid ? "input-error" : undefined}
            maxLength={PLAN_NAME_MAX_LENGTH}
            value={plan.name}
            aria-invalid={nameInvalid}
            onChange={(event) => {
              updatePlan({ name: event.target.value });
            }}
            onBlur={() => {
              setNameTouched(true);
            }}
          />
          {nameInvalid && <p className="field-error">{PLAN_NAME_ERROR}</p>}
        </div>

        <fieldset className="field">
          <legend className="field-label">選手種別</legend>
          <label htmlFor="player-type-pitcher-input">
            <input
              id="player-type-pitcher-input"
              type="radio"
              name="player-type"
              data-testid="player-type-pitcher"
              checked={plan.playerType === "pitcher"}
              onChange={() => {
                handlePlayerType("pitcher");
              }}
            />
            投手
          </label>
          <label htmlFor="player-type-fielder-input">
            <input
              id="player-type-fielder-input"
              type="radio"
              name="player-type"
              data-testid="player-type-fielder"
              checked={plan.playerType === "fielder"}
              onChange={() => {
                handlePlayerType("fielder");
              }}
            />
            野手
          </label>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">センス○</legend>
          <label htmlFor="sense-plus-input">
            <input
              id="sense-plus-input"
              type="radio"
              name="sense-mode"
              data-testid="sense-plus"
              checked={plan.senseMode === "sense_plus"}
              onChange={() => {
                updatePlan({ senseMode: "sense_plus" });
              }}
            />
            あり
          </label>
          <label htmlFor="sense-normal-input">
            <input
              id="sense-normal-input"
              type="radio"
              name="sense-mode"
              data-testid="sense-normal"
              checked={plan.senseMode === "normal"}
              onChange={() => {
                updatePlan({ senseMode: "normal" });
              }}
            />
            なし
          </label>
        </fieldset>
      </div>

      {/* 注意バッジはヘッダーに常時表示する。ここでは games.json の補足説明のみを出す */}
      {game !== null && game.note !== "" && (
        <p className="notice-sample" data-testid="game-note">
          {game.note}
        </p>
      )}

      {status === "loading" && <p data-testid="load-status-loading">CSVを読み込み中…</p>}

      {status === "ready" && gameData && (
        <details className="row-counts" data-testid="load-row-counts">
          <summary>読み込んだ行数</summary>
          <ul>
            {describeRowCounts(gameData).map((entry) => (
              <li key={entry.kind} data-testid={`row-count-${entry.kind}`}>
                {entry.label} {entry.count}行
              </li>
            ))}
          </ul>
        </details>
      )}

      {status === "error" && loadError && (
        <IssuePanel
          testId="load-error-panel"
          title={loadError.message}
          issues={loadError.issues}
          omittedCount={loadError.omittedCount}
        />
      )}

      <CsvImportPanel />
    </section>
  );
}
