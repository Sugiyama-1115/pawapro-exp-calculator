/**
 * 検証エラーの一覧表示（05_ui_spec.md §3.1 / 07_error_spec.md §1.5）。
 * 最初の1件で打ち切らず、収集済みの全件を表示する。
 */
import type { ValidationIssue } from "@/store/useGameDataStore";

export interface IssuePanelProps {
  title: string;
  issues: ValidationIssue[];
  /** 表示上限を超えて切り捨てられた件数。 */
  omittedCount?: number;
  testId?: string;
}

export function IssuePanel({
  title,
  issues,
  omittedCount = 0,
  testId,
}: IssuePanelProps): JSX.Element {
  return (
    <div className="issue-panel" role="alert" data-testid={testId}>
      <p className="issue-panel-title">{title}</p>
      {issues.length > 0 && (
        <ul className="issue-panel-list">
          {issues.map((issue, index) => (
            <li key={`${issue.file}-${issue.line ?? "-"}-${index}`}>
              <span className="issue-code">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      )}
      {omittedCount > 0 && <p className="issue-panel-omitted">他 {omittedCount} 件は省略しました。</p>}
    </div>
  );
}
