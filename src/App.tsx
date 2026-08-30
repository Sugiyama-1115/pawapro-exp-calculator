/**
 * アプリ骨格（05_ui_spec.md §1）。
 * ヘッダー・タブバー・結果サマリーバーを組み立て、初期ロードと再計算購読を開始する。
 * 計算・検証・永続化の実装は持たず、store 経由でのみ状態を扱う。
 */
import { useEffect, useState } from "react";
import { isSampleGame, selectCurrentGame, useGameDataStore } from "@/store/useGameDataStore";
import { usePlanStore } from "@/store/usePlanStore";
import { startResultSync } from "@/store/useResultStore";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { ResultSummaryBar } from "@/ui/components/ResultSummaryBar";
import { BaseAbilityTab } from "@/ui/tabs/BaseAbilityTab";
import { BreakingBallTab } from "@/ui/tabs/BreakingBallTab";
import { PlanSettingTab } from "@/ui/tabs/PlanSettingTab";
import { ResultTab } from "@/ui/tabs/ResultTab";
import { SpecialAbilityTab } from "@/ui/tabs/SpecialAbilityTab";

export const GAME_CHANGE_CONFIRM =
  "ゲームを変更すると、選択中の特殊能力・変化球データが現在の入力と一致しなくなる場合があります。続行しますか？";

export type TabId = "plan" | "base" | "special" | "breaking" | "result";

const TABS: { id: TabId; label: string }[] = [
  { id: "plan", label: "1 選手設定" },
  { id: "base", label: "2 基礎能力" },
  { id: "special", label: "3 特殊能力" },
  { id: "breaking", label: "4 変化球" },
  { id: "result", label: "5 計算結果" },
];

let bootstrapStarted = false;

/** テストで初期化を再実行するためのリセット。 */
export function resetAppBootstrap(): void {
  bootstrapStarted = false;
}

async function bootstrap(): Promise<void> {
  await useGameDataStore.getState().initialize();
  const { gameId, defaultGameId } = useGameDataStore.getState();
  await usePlanStore.getState().bootstrap(gameId ?? defaultGameId);
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<TabId>("plan");

  const games = useGameDataStore((state) => state.games);
  const gameId = useGameDataStore((state) => state.gameId);
  const status = useGameDataStore((state) => state.status);
  const game = useGameDataStore((state) => selectCurrentGame(state));
  const loadGame = useGameDataStore((state) => state.loadGame);
  const gameDataWarning = useGameDataStore((state) => state.storageWarning);

  const playerType = usePlanStore((state) => state.plan?.playerType ?? "pitcher");
  const changeGame = usePlanStore((state) => state.changeGame);
  const planWarning = usePlanStore((state) => state.storageWarning);

  useEffect(() => {
    const stopResultSync = startResultSync();
    if (!bootstrapStarted) {
      bootstrapStarted = true;
      void bootstrap();
    }
    return stopResultSync;
  }, []);

  // 野手プランでは変化球タブを出さない（FR-BR-08）
  const visibleTabs = TABS.filter((entry) => entry.id !== "breaking" || playerType === "pitcher");
  const activeTab = visibleTabs.some((entry) => entry.id === tab) ? tab : "plan";

  function handleGameChange(nextGameId: string): void {
    if (nextGameId === gameId) return;
    if (!window.confirm(GAME_CHANGE_CONFIRM)) return;
    // 入力内容はクリアしない。存在しない能力は計算時に *_DATA_MISSING として報告される
    changeGame(nextGameId);
    void loadGame(nextGameId);
  }

  const warning = gameDataWarning ?? planWarning;

  return (
    <ErrorBoundary>
      <div className="app" data-testid="app-root">
        <header className="app-header">
          <h1>パワプロ必要経験点計算</h1>
          <div className="header-controls">
            <label htmlFor="game-select-input">ゲーム</label>
            <select
              id="game-select-input"
              data-testid="game-select"
              value={gameId ?? ""}
              onChange={(event) => {
                handleGameChange(event.target.value);
              }}
            >
              {games.length === 0 && <option value="">読み込み中…</option>}
              {games.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </div>
          {isSampleGame(game) && (
            <p className="badge badge-sample" data-testid="sample-data-badge">
              サンプルデータ（実際の値ではありません）
            </p>
          )}
        </header>

        {warning !== null && (
          <p className="storage-warning" role="alert" data-testid="storage-warning">
            {warning}
          </p>
        )}

        <nav className="tab-bar" role="tablist" aria-label="画面切替">
          {visibleTabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`tab-button-${entry.id}`}
              aria-selected={activeTab === entry.id}
              aria-controls="tab-content"
              data-testid={`tab-${entry.id}`}
              className={activeTab === entry.id ? "tab-button tab-active" : "tab-button"}
              // ロード未完了・ロードエラー時はタブ1以外を操作させない（05_ui_spec.md §3.1）
              disabled={entry.id !== "plan" && status !== "ready"}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <main className="tab-content" id="tab-content" role="tabpanel">
          {activeTab === "plan" && <PlanSettingTab />}
          {activeTab === "base" && <BaseAbilityTab />}
          {activeTab === "special" && <SpecialAbilityTab />}
          {activeTab === "breaking" && <BreakingBallTab />}
          {activeTab === "result" && <ResultTab />}
        </main>

        <footer className="app-footer">
          <ResultSummaryBar
            onIssueCountClick={() => {
              setTab("result");
            }}
          />
        </footer>
      </div>
    </ErrorBoundary>
  );
}
