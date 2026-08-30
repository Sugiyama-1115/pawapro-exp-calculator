/**
 * UI-CM 系の自動化分（05_ui_spec.md §2）。
 * 共通コンポーネントの表示規則を検証する。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary, UNEXPECTED_ERROR_MESSAGE } from "@/ui/ErrorBoundary";
import { ExpVectorTable } from "@/ui/components/ExpVectorTable";
import { ResultSummaryBar } from "@/ui/components/ResultSummaryBar";
import { SourceBadge } from "@/ui/components/SourceBadge";
import { useResultStore } from "@/store/useResultStore";
import type { CalculationResult } from "@/domain/models/result";
import { zeroVector } from "@/domain/models/expVector";

afterEach(() => {
  cleanup();
  useResultStore.setState({ result: null, calculating: false });
});

function makeResult(partial: Partial<CalculationResult>): CalculationResult {
  return {
    total: zeroVector(),
    subtotal: { base: zeroVector(), blue: zeroVector(), gold: zeroVector(), breaking: zeroVector() },
    base: [],
    blue: [],
    gold: [],
    breaking: [],
    status: "confirmed",
    issues: [],
    ...partial,
  };
}

describe("ExpVectorTable", () => {
  it("UI-CM-06: 4桁以上の値は3桁カンマ区切りで表示する", () => {
    render(
      <ExpVectorTable
        vector={{ muscle: 1820, agility: 430, technique: 2240, breaking: 1650, mental: 0 }}
        testIdPrefix="exp"
      />,
    );

    expect(screen.getByTestId("exp-muscle").textContent).toBe("1,820");
    expect(screen.getByTestId("exp-agility").textContent).toBe("430");
    expect(screen.getByTestId("exp-mental").textContent).toBe("0");
  });

  it("値が 0 のカテゴリはグレー表示のクラスが付く", () => {
    render(<ExpVectorTable vector={{ ...zeroVector(), muscle: 10 }} testIdPrefix="exp" />);

    expect(screen.getByTestId("exp-muscle").className).not.toContain("exp-zero");
    expect(screen.getByTestId("exp-breaking").className).toContain("exp-zero");
  });
});

describe("SourceBadge", () => {
  it("master はバッジを表示しない", () => {
    const { container } = render(<SourceBadge source="master" testId="source-badge-gold-x" />);
    expect(container.firstChild).toBeNull();
  });

  it("出どころごとに日本語ラベルを表示する（色のみに依存しない）", () => {
    render(
      <>
        <SourceBadge source="measured" testId="badge-measured" />
        <SourceBadge source="estimated_high" testId="badge-estimated-high" />
        <SourceBadge source="estimated" testId="badge-estimated" />
        <SourceBadge source="manual" testId="badge-manual" />
      </>,
    );

    expect(screen.getByTestId("badge-measured").textContent).toBe("実測");
    expect(screen.getByTestId("badge-estimated-high").textContent).toBe("高信頼推定");
    expect(screen.getByTestId("badge-estimated").textContent).toBe("推定");
    expect(screen.getByTestId("badge-manual").textContent).toBe("手動入力");
  });
});

describe("ResultSummaryBar", () => {
  it("5カテゴリ・合計・ステータスを表示する", () => {
    useResultStore.setState({
      result: makeResult({
        total: { muscle: 1820, agility: 430, technique: 2240, breaking: 1650, mental: 1310 },
        status: "estimated",
      }),
      calculating: false,
    });

    render(<ResultSummaryBar onIssueCountClick={() => undefined} />);

    expect(screen.getByTestId("summary-muscle").textContent).toBe("1,820");
    expect(screen.getByTestId("summary-total").textContent).toBe("7,450");
    expect(screen.getByTestId("summary-status").textContent).toBe("推定含む");
  });

  it("不足0件では件数を表示せず、1件以上ではクリックで通知する", () => {
    useResultStore.setState({ result: makeResult({}), calculating: false });
    const onIssueCountClick = vi.fn();
    const view = render(<ResultSummaryBar onIssueCountClick={onIssueCountClick} />);
    expect(screen.queryByTestId("summary-issue-count")).toBeNull();

    useResultStore.setState({
      result: makeResult({
        status: "incomplete",
        issues: [
          { code: "BASE_DATA_MISSING", category: "base", targetId: "stamina", message: "不足1" },
          { code: "BREAKING_DATA_MISSING", category: "breaking", targetId: "-", message: "不足2" },
        ],
      }),
    });
    view.rerender(<ResultSummaryBar onIssueCountClick={onIssueCountClick} />);

    const button = screen.getByTestId("summary-issue-count");
    expect(button.textContent).toContain("2");
    fireEvent.click(button);
    expect(onIssueCountClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("summary-status").textContent).toBe("未完成");
  });

  it("結果が未計算のときは合計 0・ステータス — を表示する", () => {
    render(<ResultSummaryBar onIssueCountClick={() => undefined} />);

    expect(screen.getByTestId("summary-total").textContent).toBe("0");
    expect(screen.getByTestId("summary-status").textContent).toBe("—");
  });
});

describe("ErrorBoundary", () => {
  it("未捕捉例外を握りつぶさず案内を表示する（07_error_spec.md §4）", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Broken(): JSX.Element {
      throw new Error("想定外の失敗");
    }

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    const panel = screen.getByTestId("app-error-boundary");
    expect(panel.textContent).toContain(UNEXPECTED_ERROR_MESSAGE);
    expect(panel.textContent).toContain("想定外の失敗");
    consoleError.mockRestore();
  });

  it("例外が無ければ子要素をそのまま表示する", () => {
    render(
      <ErrorBoundary>
        <p>正常</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("正常")).toBeTruthy();
    expect(screen.queryByTestId("app-error-boundary")).toBeNull();
  });
});
