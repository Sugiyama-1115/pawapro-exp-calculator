/**
 * 結果サマリーバー（05_ui_spec.md §2.1）。全タブで常時表示する（FR-R-08）。
 */
import { useResultStore } from "@/store/useResultStore";
import type { ResultStatus } from "@/domain/models/result";
import { totalOf, zeroVector } from "@/domain/models/expVector";
import { formatNumber } from "@/utils/number";
import { ExpVectorTable } from "./ExpVectorTable";

const STATUS_LABELS: Record<ResultStatus, string> = {
  confirmed: "確定",
  estimated: "推定含む",
  incomplete: "未完成",
};

export interface ResultSummaryBarProps {
  /** 不足件数のクリックで計算結果タブの不足一覧へ遷移する。 */
  onIssueCountClick(): void;
}

export function ResultSummaryBar({ onIssueCountClick }: ResultSummaryBarProps): JSX.Element {
  const result = useResultStore((state) => state.result);
  const calculating = useResultStore((state) => state.calculating);

  const vector = result?.total ?? zeroVector();
  const issueCount = result?.issues.length ?? 0;

  return (
    <div className="summary-bar" data-testid="summary-bar">
      <ExpVectorTable vector={vector} testIdPrefix="summary" />
      <div className="summary-total" aria-live="polite">
        <span className="summary-total-label">合計</span>
        <span className="summary-total-value" data-testid="summary-total">
          {formatNumber(totalOf(vector))}
        </span>
        {calculating && (
          <span className="summary-spinner" role="status" aria-label="再計算中">
            …
          </span>
        )}
      </div>
      <div className="summary-meta">
        <span
          className={`badge badge-status badge-${result?.status ?? "unknown"}`}
          data-testid="summary-status"
        >
          {result === null ? "—" : STATUS_LABELS[result.status]}
        </span>
        {issueCount > 0 && (
          <button
            type="button"
            className="summary-issue-count"
            data-testid="summary-issue-count"
            onClick={onIssueCountClick}
          >
            不足 {formatNumber(issueCount)}件
          </button>
        )}
      </div>
    </div>
  );
}
