/**
 * 不足データ一覧（05_ui_spec.md §7）。
 * 計算で収集した issue を全件表示する。0件のときは何も描画しない。
 */
import type { CalculationIssue } from "@/domain/models/result";
import { formatNumber } from "@/utils/number";

export interface IssueListProps {
  issues: CalculationIssue[];
}

export function IssueList({ issues }: IssueListProps): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <section className="issue-panel" role="alert" data-testid="issue-list">
      <h3 className="issue-panel-title">不足データ（{formatNumber(issues.length)}件）</h3>
      <ul className="issue-panel-list">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.targetId}-${index}`} data-testid={`issue-item-${index}`}>
            ⚠ <span className="issue-code">[{issue.code}]</span> {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
