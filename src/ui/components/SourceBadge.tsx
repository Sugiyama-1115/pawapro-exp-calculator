/**
 * 出どころバッジ（05_ui_spec.md §2.2）。
 * 色だけに依存せず、必ずテキストを併記する（05_ui_spec.md §10）。
 */
import type { ItemSource } from "@/domain/models/result";

const SOURCE_LABELS: Record<ItemSource, string | null> = {
  master: null,
  measured: "実測",
  estimated_high: "高信頼推定",
  estimated: "推定",
  manual: "手動入力",
};

export interface SourceBadgeProps {
  source: ItemSource;
  testId?: string;
}

export function SourceBadge({ source, testId }: SourceBadgeProps): JSX.Element | null {
  const label = SOURCE_LABELS[source];
  if (label === null) return null;
  return (
    <span className={`badge badge-source badge-${source}`} data-testid={testId}>
      {label}
    </span>
  );
}
