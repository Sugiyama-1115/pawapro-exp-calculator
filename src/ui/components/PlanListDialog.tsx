/**
 * プラン一覧ダイアログ（05_ui_spec.md §8）。
 * 一覧の並び順・複製・削除の規則は store / data 層に委ね、ここでは操作と確認のみを扱う。
 */
import { useEffect, useState, type ChangeEvent } from "react";
import type { PlayerPlan } from "@/domain/models/plan";
import { useGameDataStore } from "@/store/useGameDataStore";
import { usePlanListStore } from "@/store/usePlanListStore";
import { usePlanStore } from "@/store/usePlanStore";

export const PLAN_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const PLAN_IMPORT_INVALID_FILE = "JSONファイル（20MB以下）を選択してください。";

export function deleteConfirmMessage(name: string): string {
  return `プラン『${name}』を削除します。元に戻せません。よろしいですか？`;
}

export function planImportedMessage(name: string): string {
  return `プラン『${name}』を読み込みました。`;
}

const PLAYER_TYPE_LABELS: Record<PlayerPlan["playerType"], string> = {
  pitcher: "投手",
  fielder: "野手",
};

/** `YYYY-MM-DD HH:mm`（ローカル時刻）。解釈できない値はそのまま表示する。 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export interface PlanListDialogProps {
  open: boolean;
  onClose(): void;
  /** プランを開いた・作成した直後に選手設定タブへ移動させる。 */
  onPlanOpened(): void;
}

export function PlanListDialog({ open, onClose, onPlanOpened }: PlanListDialogProps): JSX.Element | null {
  const plans = usePlanListStore((state) => state.plans);
  const refresh = usePlanListStore((state) => state.refresh);
  const duplicate = usePlanListStore((state) => state.duplicate);
  const remove = usePlanListStore((state) => state.remove);
  const importPlanJson = usePlanListStore((state) => state.importPlanJson);

  const games = useGameDataStore((state) => state.games);
  const gameId = useGameDataStore((state) => state.gameId);
  const defaultGameId = useGameDataStore((state) => state.defaultGameId);

  const currentPlanId = usePlanStore((state) => state.plan?.id ?? null);
  const newPlan = usePlanStore((state) => state.newPlan);
  const openPlan = usePlanStore((state) => state.openPlan);

  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const gameNameOf = (id: string): string =>
    games.find((game) => game.id === id)?.displayName ?? id;

  function handleNew(): void {
    newPlan(gameId ?? defaultGameId);
    void refresh();
    onPlanOpened();
    onClose();
  }

  function handleOpen(id: string): void {
    void openPlan(id).then(() => {
      onPlanOpened();
      onClose();
    });
  }

  function handleDelete(id: string, name: string): void {
    if (!window.confirm(deleteConfirmMessage(name))) return;
    void remove(id).then(() => {
      // 編集中のプランを消した場合は空のプランへ切り替える（自動保存で復活させないため）
      if (id === currentPlanId) newPlan(gameId ?? defaultGameId);
    });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // 同じファイルを続けて選び直せるように入力値は毎回クリアする
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") || file.size > PLAN_IMPORT_MAX_BYTES) {
      setMessage(PLAN_IMPORT_INVALID_FILE);
      return;
    }
    const outcome = await importPlanJson(await file.text(), games.map((game) => game.id));
    setMessage(
      outcome.ok
        ? `${planImportedMessage(outcome.plan.name)}${outcome.warning ?? ""}`
        : outcome.message,
    );
  }

  return (
    <div className="modal-backdrop" data-testid="plan-list-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="プラン一覧"
        data-testid="plan-list-dialog"
      >
        <div className="modal-header">
          <h2>プラン一覧</h2>
          <button type="button" data-testid="plan-list-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" data-testid="plan-new" onClick={handleNew}>
            + 新規作成
          </button>
          <label htmlFor="plan-import-json-input">JSONから読み込む</label>
          <input
            id="plan-import-json-input"
            type="file"
            accept=".json,application/json"
            data-testid="plan-import-json"
            onChange={(event) => {
              void handleImport(event);
            }}
          />
        </div>

        {message !== null && (
          <p className="field-note" role="status" data-testid="plan-list-message">
            {message}
          </p>
        )}

        <table className="plan-list-table">
          <thead>
            <tr>
              <th scope="col">名前</th>
              <th scope="col">種別</th>
              <th scope="col">ゲーム</th>
              <th scope="col">更新日時</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((summary) => (
              <tr key={summary.id} data-testid={`plan-row-${summary.id}`}>
                <th scope="row">{summary.name}</th>
                <td>{PLAYER_TYPE_LABELS[summary.playerType]}</td>
                <td>{gameNameOf(summary.gameId)}</td>
                <td>{formatDateTime(summary.updatedAt)}</td>
                <td>
                  <button
                    type="button"
                    data-testid={`plan-open-${summary.id}`}
                    onClick={() => {
                      handleOpen(summary.id);
                    }}
                  >
                    開く
                  </button>
                  <button
                    type="button"
                    data-testid={`plan-duplicate-${summary.id}`}
                    onClick={() => {
                      void duplicate(summary.id);
                    }}
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    data-testid={`plan-delete-${summary.id}`}
                    onClick={() => {
                      handleDelete(summary.id, summary.name);
                    }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && <p className="field-note">保存済みのプランはありません。</p>}
      </div>
    </div>
  );
}
