/**
 * 最上位の Error Boundary（07_error_spec.md §4）。
 * 未捕捉例外を握りつぶさず、利用者に読める形で表示する。
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

export const UNEXPECTED_ERROR_MESSAGE = "予期しないエラーが発生しました。再読み込みしてください。";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  message: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 外部送信は行わない（06_persistence_spec.md §7）。開発時の調査用にのみ出力する。
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="issue-panel" role="alert" data-testid="app-error-boundary">
        <p className="issue-panel-title">{UNEXPECTED_ERROR_MESSAGE}</p>
        <p>{this.state.message}</p>
      </div>
    );
  }
}
