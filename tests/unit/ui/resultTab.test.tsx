/**
 * UI-T5 系の自動化分（05_ui_spec.md §7）。
 * 期待値は 11_unit_test_spec.md §1 の標準フィクスチャから導出した確定値（E2E-01 と同一）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PlayerPlan } from "@/domain/models/plan";
import { createSampleGameData } from "../../fixtures/sampleGameData";

const savePlan = vi.fn();
const downloadText = vi.fn();

vi.mock("@/data/repositories/gameDataLoader", () => ({
  loadGamesManifest: () => Promise.resolve({ games: [], defaultGameId: "" }),
  loadGameData: () => Promise.resolve(createSampleGameData()),
}));

vi.mock("@/data/persistence/db", () => ({
  getAppState: () => Promise.resolve(null),
  setAppState: () => Promise.resolve(undefined),
}));

vi.mock("@/data/persistence/breakingCacheRepository", () => ({
  loadBreakingCacheEntries: () => Promise.resolve([]),
  saveBreakingCacheRows: () => Promise.resolve(undefined),
}));

vi.mock("@/data/persistence/planRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/planRepository")>();
  return {
    ...actual,
    getPlan: () => Promise.resolve(null),
    savePlan: (...args: unknown[]) => savePlan(...args) as unknown,
  };
});

vi.mock("@/data/persistence/exporter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/persistence/exporter")>();
  return { ...actual, downloadText: (...args: unknown[]) => downloadText(...args) as unknown };
});

const { useGameDataStore } = await import("@/store/useGameDataStore");
const { cancelPendingSave, createEmptyPlan, usePlanStore } = await import("@/store/usePlanStore");
const { useResultStore } = await import("@/store/useResultStore");
const { ResultTab, STATUS_LABELS } = await import("@/ui/tabs/ResultTab");

function setPlan(patch: Partial<PlayerPlan>): void {
  usePlanStore.setState({
    plan: {
      ...createEmptyPlan("sample2024", "plan-1", "2026-08-31T00:00:00.000Z"),
      name: "エース候補A",
      ...patch,
    },
    dirty: false,
  });
  act(() => {
    useResultStore.getState().recalculate();
  });
}

beforeEach(() => {
  cancelPendingSave();
  savePlan.mockImplementation((plan: unknown) => Promise.resolve(plan));
  useGameDataStore.setState({
    status: "ready",
    games: [],
    defaultGameId: "sample2024",
    gameId: "sample2024",
    gameData: createSampleGameData(),
    loadError: null,
    overrides: [],
    storageWarning: null,
  });
  useResultStore.setState({ result: null, calculating: false });
});

afterEach(() => {
  cleanup();
  cancelPendingSave();
  vi.clearAllMocks();
});

describe("ResultTab", () => {
  it("UI-T5-01: 5カテゴリと合計が表示される", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    expect(screen.getByTestId("result-total-muscle").textContent).toBe("32");
    expect(screen.getByTestId("result-total-agility").textContent).toBe("0");
    expect(screen.getByTestId("result-total-technique").textContent).toBe("16");
    expect(screen.getByTestId("result-total-breaking").textContent).toBe("0");
    expect(screen.getByTestId("result-total-mental").textContent).toBe("0");
    expect(screen.getByTestId("result-total-all").textContent).toBe("48");
  });

  it("UI-T5-02: 内訳が4区分で項目別に表示される", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    for (const category of ["base", "blue", "gold", "breaking"]) {
      expect(screen.getByTestId(`result-category-${category}`)).toBeTruthy();
    }
    expect(screen.getByTestId("result-item-base-velocity").textContent).toContain("130 → 133");
  });

  it("UI-T5-03: 出どころが識別できるバッジを表示する", () => {
    setPlan({
      breakingPlan: {
        composition: [{ pitchType: "slider", level: 4 }],
        mode: "aggregate",
        aggregate: { muscle: 0, agility: 0, technique: 450, breaking: 1280, mental: 100 },
        steps: [],
      },
    });
    render(<ResultTab />);

    expect(screen.getByTestId("source-badge-breaking-aggregate").textContent).toBe("手動入力");
  });

  it("UI-T5-04: 実測データだけならステータスは確定になる", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    expect(screen.getByTestId("result-status").textContent).toBe(STATUS_LABELS.confirmed);
  });

  it("UI-T5-06: データ不足があるとステータスは未完成になり不足一覧が出る", () => {
    setPlan({
      breakingPlan: {
        composition: [{ pitchType: "slider", level: 4 }],
        mode: "none",
        aggregate: null,
        steps: [],
      },
    });
    render(<ResultTab />);

    expect(screen.getByTestId("result-status").textContent).toBe(STATUS_LABELS.incomplete);
    expect(screen.getByTestId("issue-list")).toBeTruthy();
    expect(screen.getByTestId("issue-item-0").textContent).toContain("BREAKING_DATA_MISSING");
  });

  it("UI-T5-08: 不足が無いときは不足データパネルを表示しない", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    expect(screen.queryByTestId("issue-list")).toBeNull();
  });

  it("UI-T5-10: 内訳の小計と合計が一致する", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    const result = useResultStore.getState().result;
    const subtotalSum = (["base", "blue", "gold", "breaking"] as const).reduce(
      (sum, category) => sum + (result?.subtotal[category].muscle ?? 0),
      0,
    );
    expect(subtotalSum).toBe(result?.total.muscle);
    expect(screen.getByTestId("result-subtotal-base").textContent).toContain("筋力 32");
  });

  it("UI-T5-11: 結果CSVを BOM 付きでダウンロードする", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    fireEvent.click(screen.getByTestId("export-result-csv"));

    expect(downloadText).toHaveBeenCalledTimes(1);
    const [fileName, content, mimeType] = downloadText.mock.calls[0] as [string, string, string];
    expect(fileName.startsWith("result_エース候補A_")).toBe(true);
    expect(fileName.endsWith(".csv")).toBe(true);
    expect(content.startsWith("﻿")).toBe(true);
    expect(mimeType).toContain("text/csv");
  });

  it("UI-T5-12: 結果JSONをダウンロードする", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    fireEvent.click(screen.getByTestId("export-result-json"));

    const [fileName, content] = downloadText.mock.calls[0] as [string, string];
    expect(fileName.endsWith(".json")).toBe(true);
    expect((JSON.parse(content) as { total: { muscle: number } }).total.muscle).toBe(32);
  });

  it("UI-PL-08: プランJSONをダウンロードする", () => {
    setPlan({ currentBase: { velocity: 130 }, targetBase: { velocity: 133 } });
    render(<ResultTab />);

    fireEvent.click(screen.getByTestId("export-plan-json"));

    const [fileName, content] = downloadText.mock.calls[0] as [string, string];
    expect(fileName.startsWith("plan_エース候補A_")).toBe(true);
    const parsed = JSON.parse(content) as { format: string; plan: { id: string } };
    expect(parsed.format).toBe("pawapro-exp-calculator/plan");
    expect(parsed.plan.id).toBe("plan-1");
  });
});
