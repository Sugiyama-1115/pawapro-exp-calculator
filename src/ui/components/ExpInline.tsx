/**
 * 1行分の経験点を横並びで表示する（05_ui_spec.md §4・§5 のレイアウト）。
 * 表形式の `ExpVectorTable` と表示規則（カテゴリ順・0 のグレー表示）を揃える。
 */
import type { ExpVector } from "@/domain/models/expVector";
import { EXP_KEYS } from "@/domain/models/expVector";
import { formatNumber } from "@/utils/number";
import { EXP_LABELS } from "./ExpVectorTable";

export interface ExpInlineProps {
  vector: ExpVector;
  testId?: string;
  /** 値が 0 のカテゴリを省略する（05_ui_spec.md §7 の内訳行）。 */
  omitZero?: boolean;
}

export function ExpInline({ vector, testId, omitZero = false }: ExpInlineProps): JSX.Element {
  const keys = omitZero ? EXP_KEYS.filter((key) => vector[key] !== 0) : EXP_KEYS;
  return (
    <span className="exp-inline" data-testid={testId}>
      {keys.map((key) => (
        <span key={key} className={vector[key] === 0 ? "exp-zero" : undefined}>
          {EXP_LABELS[key]} {formatNumber(vector[key])}
        </span>
      ))}
    </span>
  );
}
