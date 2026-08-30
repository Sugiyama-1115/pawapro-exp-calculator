/**
 * UT-ST-LIST: プラン一覧ストア（05_ui_spec.md §8）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/domain/errors/appError";
import { ERROR_CODES } from "@/domain/errors/errorCodes";
import type { PlanSummary } from "@/data/persistence/planRepository";

const listPlanSummaries = vi.fn();
const duplicatePlan = vi.fn();
const deletePlan = vi.fn();

vi.mock("@/data/persistence/planRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/planRepository")>();
  return {
    ...actual,
    listPlanSummaries: (...args: unknown[]) => listPlanSummaries(...args) as unknown,
    duplicatePlan: (...args: unknown[]) => duplicatePlan(...args) as unknown,
    deletePlan: (...args: unknown[]) => deletePlan(...args) as unknown,
  };
});

const { usePlanListStore } = await import("@/store/usePlanListStore");

const SUMMARIES: PlanSummary[] = [
  {
    id: "plan-2",
    name: "4番打者B",
    gameId: "sample2024",
    playerType: "fielder",
    createdAt: "2026-08-29T09:10:00.000Z",
    updatedAt: "2026-08-30T14:22:00.000Z",
  },
  {
    id: "plan-1",
    name: "エース候補A",
    gameId: "sample2024",
    playerType: "pitcher",
    createdAt: "2026-08-28T09:10:00.000Z",
    updatedAt: "2026-08-29T09:10:00.000Z",
  },
];

beforeEach(() => {
  listPlanSummaries.mockResolvedValue(SUMMARIES);
  duplicatePlan.mockResolvedValue(null);
  deletePlan.mockResolvedValue(undefined);
  usePlanListStore.setState({ plans: [], loading: false, storageWarning: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePlanListStore", () => {
  it("UT-ST-LIST-01: refresh で data 層の並び順（updatedAt 降順）のまま保持する", async () => {
    await usePlanListStore.getState().refresh();

    expect(usePlanListStore.getState().plans.map((plan) => plan.id)).toEqual(["plan-2", "plan-1"]);
    expect(usePlanListStore.getState().loading).toBe(false);
  });

  it("UT-ST-LIST-02: 複製すると一覧を再取得し、複製結果のサマリーを返す", async () => {
    duplicatePlan.mockResolvedValue({
      id: "plan-3",
      name: "エース候補A のコピー",
      gameId: "sample2024",
      playerType: "pitcher",
      senseMode: "sense_plus",
      currentBase: {},
      targetBase: {},
      blueTargets: [],
      goldTargets: [],
      breakingPlan: null,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    });

    const copy = await usePlanListStore.getState().duplicate("plan-1");

    expect(copy?.name).toBe("エース候補A のコピー");
    expect(listPlanSummaries).toHaveBeenCalledTimes(1);
  });

  it("UT-ST-LIST-03: 削除すると一覧を再取得する", async () => {
    await usePlanListStore.getState().remove("plan-1");

    expect(deletePlan).toHaveBeenCalledWith("plan-1");
    expect(listPlanSummaries).toHaveBeenCalledTimes(1);
  });

  it("UT-ST-LIST-04: 読み込み失敗は警告として保持し、一覧は空になる", async () => {
    listPlanSummaries.mockRejectedValue(
      new AppError(ERROR_CODES.STORAGE_ERROR, "保存データの読み込みに失敗しました。"),
    );

    await usePlanListStore.getState().refresh();

    expect(usePlanListStore.getState().plans).toEqual([]);
    expect(usePlanListStore.getState().storageWarning).toBe("保存データの読み込みに失敗しました。");
  });
});
