/**
 * UI-PL 系の自動化分（05_ui_spec.md §8 / 06_persistence_spec.md §5.2）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildPlanJson } from "@/data/persistence/exporter";
import type { PlanSummary } from "@/data/persistence/planRepository";
import type { GameDefinition } from "@/data/repositories/gameDataLoader";
import type { PlayerPlan } from "@/domain/models/plan";

const listPlanSummaries = vi.fn();
const duplicatePlan = vi.fn();
const deletePlan = vi.fn();
const getPlan = vi.fn();
const savePlan = vi.fn();

vi.mock("@/data/persistence/db", () => ({
  getAppState: () => Promise.resolve(null),
  setAppState: () => Promise.resolve(undefined),
}));

vi.mock("@/data/persistence/planRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/planRepository")>();
  return {
    ...actual,
    listPlanSummaries: (...args: unknown[]) => listPlanSummaries(...args) as unknown,
    duplicatePlan: (...args: unknown[]) => duplicatePlan(...args) as unknown,
    deletePlan: (...args: unknown[]) => deletePlan(...args) as unknown,
    getPlan: (...args: unknown[]) => getPlan(...args) as unknown,
    savePlan: (...args: unknown[]) => savePlan(...args) as unknown,
  };
});

const { useGameDataStore } = await import("@/store/useGameDataStore");
const { usePlanListStore } = await import("@/store/usePlanListStore");
const { cancelPendingSave, createEmptyPlan, usePlanStore } = await import("@/store/usePlanStore");
const { deleteConfirmMessage, PlanListDialog } = await import("@/ui/components/PlanListDialog");
const { PLAN_IMPORT_WRONG_FORMAT } = await import("@/store/usePlanListStore");

const GAMES: GameDefinition[] = [
  {
    id: "sample2024",
    displayName: "サンプルデータ（ダミー値）",
    directory: "sample2024",
    bundled: true,
    note: "",
  },
];

const SUMMARIES: PlanSummary[] = [
  {
    id: "plan-2",
    name: "4番打者B",
    gameId: "sample2024",
    playerType: "fielder",
    createdAt: "2026-08-29T00:10:00.000Z",
    updatedAt: "2026-08-30T05:22:00.000Z",
  },
  {
    id: "plan-1",
    name: "エース候補A",
    gameId: "sample2024",
    playerType: "pitcher",
    createdAt: "2026-08-28T00:10:00.000Z",
    updatedAt: "2026-08-29T00:10:00.000Z",
  },
];

const IMPORTED: PlayerPlan = {
  ...createEmptyPlan("sample2024", "plan-9", "2026-08-20T00:00:00.000Z"),
  name: "読み込みプラン",
};

function jsonFile(name: string, text: string, size = text.length): File {
  return { name, size, text: () => Promise.resolve(text) } as unknown as File;
}

function renderDialog(): { onClose: () => void; onPlanOpened: () => void } {
  const onClose = vi.fn();
  const onPlanOpened = vi.fn();
  render(<PlanListDialog open onClose={onClose} onPlanOpened={onPlanOpened} />);
  return { onClose, onPlanOpened };
}

beforeEach(() => {
  cancelPendingSave();
  listPlanSummaries.mockResolvedValue(SUMMARIES);
  duplicatePlan.mockResolvedValue(null);
  deletePlan.mockResolvedValue(undefined);
  getPlan.mockResolvedValue(null);
  savePlan.mockImplementation((plan: unknown) => Promise.resolve(plan));
  useGameDataStore.setState({ games: GAMES, defaultGameId: "sample2024", gameId: "sample2024" });
  usePlanListStore.setState({ plans: [], loading: false, storageWarning: null });
  usePlanStore.setState({
    plan: createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
    dirty: false,
    storageWarning: null,
  });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("PlanListDialog", () => {
  it("UI-PL-01: 保存済みプランが更新日時降順で並ぶ", async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("plan-row-plan-2")).toBeTruthy();
    });
    const rows = screen.getAllByTestId(/^plan-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "plan-row-plan-2",
      "plan-row-plan-1",
    ]);
    expect(rows[0]?.textContent).toContain("野手");
    expect(rows[0]?.textContent).toContain("サンプルデータ（ダミー値）");
  });

  it("UI-PL-02: 新規作成すると新しいプランが開かれタブ1へ戻る", async () => {
    const { onClose, onPlanOpened } = renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-row-plan-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("plan-new"));

    expect(usePlanStore.getState().plan?.name).toBe("新規プラン");
    expect(usePlanStore.getState().plan?.id).not.toBe("plan-1");
    expect(onPlanOpened).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("UI-PL-04: 複製すると data 層の複製処理が呼ばれる", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-duplicate-plan-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("plan-duplicate-plan-1"));

    await waitFor(() => {
      expect(duplicatePlan).toHaveBeenCalledWith("plan-1");
    });
  });

  it("UI-PL-06: 削除は確認ダイアログを経てから実行される", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-delete-plan-2")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("plan-delete-plan-2"));

    expect(confirmSpy).toHaveBeenCalledWith(deleteConfirmMessage("4番打者B"));
    await waitFor(() => {
      expect(deletePlan).toHaveBeenCalledWith("plan-2");
    });
  });

  it("UI-PL-07: 削除をキャンセルするとプランは残る", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-delete-plan-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("plan-delete-plan-1"));

    expect(deletePlan).not.toHaveBeenCalled();
  });

  it("UI-PL-09: プランJSONを読み込むと別プランとして追加される", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-import-json")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("plan-import-json"), {
      target: { files: [jsonFile("plan.json", buildPlanJson(IMPORTED, new Date()))] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan-list-message").textContent).toContain("読み込みプラン");
    });
    expect((savePlan.mock.calls[0]?.[0] as PlayerPlan).name).toBe("読み込みプラン");
  });

  it("UI-PL-09: id が衝突する場合は採番し直して既存を上書きしない", async () => {
    getPlan.mockResolvedValue(IMPORTED);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-import-json")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("plan-import-json"), {
      target: { files: [jsonFile("plan.json", buildPlanJson(IMPORTED, new Date()))] },
    });

    await waitFor(() => {
      expect(savePlan).toHaveBeenCalledTimes(1);
    });
    expect((savePlan.mock.calls[0]?.[0] as PlayerPlan).id).not.toBe("plan-9");
  });

  it("UI-PL-10: 本アプリ以外のJSONは追加されない", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("plan-import-json")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("plan-import-json"), {
      target: { files: [jsonFile("other.json", JSON.stringify({ hello: "world" }))] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan-list-message").textContent).toBe(PLAN_IMPORT_WRONG_FORMAT);
    });
    expect(savePlan).not.toHaveBeenCalled();
  });
});
