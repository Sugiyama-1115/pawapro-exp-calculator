/**
 * 経験点テーブル（05_ui_spec.md §2.3）。
 * 5カテゴリを常に同じ順序・同じ列幅で表示し、0 のカテゴリは薄いグレーにする。
 */
import type { ExpKey, ExpVector } from "@/domain/models/expVector";
import { EXP_KEYS } from "@/domain/models/expVector";
import { formatNumber } from "@/utils/number";

export const EXP_LABELS: Record<ExpKey, string> = {
  muscle: "筋力",
  agility: "敏捷",
  technique: "技術",
  breaking: "変化球",
  mental: "精神",
};

export interface ExpVectorTableProps {
  vector: ExpVector;
  /** 各セルに `${testIdPrefix}-${expKey}` の data-testid を付ける。 */
  testIdPrefix?: string;
  caption?: string;
}

export function ExpVectorTable({
  vector,
  testIdPrefix,
  caption,
}: ExpVectorTableProps): JSX.Element {
  return (
    <table className="exp-table">
      {caption !== undefined && <caption>{caption}</caption>}
      <thead>
        <tr>
          {EXP_KEYS.map((key) => (
            <th key={key} scope="col">
              {EXP_LABELS[key]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {EXP_KEYS.map((key) => (
            <td
              key={key}
              className={vector[key] === 0 ? "exp-zero" : undefined}
              data-testid={testIdPrefix === undefined ? undefined : `${testIdPrefix}-${key}`}
            >
              {formatNumber(vector[key])}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
