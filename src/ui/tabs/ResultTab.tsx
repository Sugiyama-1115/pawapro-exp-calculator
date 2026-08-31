/**
 * 画面5 計算結果（05_ui_spec.md §7）。
 * 計算は行わず store の結果を表示するだけ。内訳の並びは 04_calculation_spec.md §8.3 の順序に従う。
 */
import { totalOf } from "@/domain/models/expVector";
import type { CalculationItem, ItemCategory, ResultStatus } from "@/domain/models/result";
import { ITEM_CATEGORIES } from "@/domain/models/result";
import { exportPlanJson, exportResultCsv, exportResultJson } from "@/store/exportActions";
import { usePlanStore } from "@/store/usePlanStore";
import { useResultStore } from "@/store/useResultStore";
import { formatNumber } from "@/utils/number";
import { ExpInline } from "../components/ExpInline";
import { ExpVectorTable } from "../components/ExpVectorTable";
import { IssueList } from "../components/IssueList";
import { SourceBadge } from "../components/SourceBadge";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  base: "基礎能力",
  blue: "青特殊能力",
  gold: "金特殊能力",
  breaking: "変化球",
};

export const STATUS_LABELS: Record<ResultStatus, string> = {
  confirmed: "確定",
  estimated: "推定含む",
  incomplete: "未完成",
};

/** 自動追加された項目であることを示す（05_ui_spec.md §7 の 🔗 併記）。 */
export const AUTO_ADDED_MARK = "🔗自動追加";
export const NO_ITEM_TEXT = "該当なし";

function ItemRow({ item }: { item: CalculationItem }): JSX.Element {
  return (
    <li data-testid={`result-item-${item.category}-${item.id}`}>
      <span className="result-item-name">
        {item.displayName} {item.detail}
      </span>
      {item.autoAdded && <span className="auto-note">{AUTO_ADDED_MARK}</span>}
      <SourceBadge source={item.source} testId={`source-badge-${item.category}-${item.id}`} />
      {/* 0 のカテゴリは内訳行では省略する（05_ui_spec.md §7） */}
      <ExpInline vector={item.cost} omitZero testId={`result-exp-${item.category}-${item.id}`} />
    </li>
  );
}

export function ResultTab(): JSX.Element {
  const result = useResultStore((state) => state.result);
  const plan = usePlanStore((state) => state.plan);

  if (!result || !plan) {
    return (
      <section className="tab-panel" data-testid="result-tab">
        <h2>計算結果</h2>
        <p data-testid="result-loading">計算結果を準備しています…</p>
      </section>
    );
  }

  return (
    <section className="tab-panel" data-testid="result-tab">
      <h2>計算結果</h2>

      <section className="result-total" data-testid="result-total">
        <h3>合計</h3>
        <ExpVectorTable vector={result.total} testIdPrefix="result-total" />
        <p>
          <span>合計 </span>
          <span data-testid="result-total-all">{formatNumber(totalOf(result.total))}</span>
          <span> ステータス: </span>
          <span
            className={`badge badge-status badge-${result.status}`}
            data-testid="result-status"
          >
            {STATUS_LABELS[result.status]}
          </span>
        </p>
      </section>

      <IssueList issues={result.issues} />

      <section className="result-breakdown" data-testid="result-breakdown">
        <h3>内訳</h3>
        {ITEM_CATEGORIES.map((category) => (
          <section
            key={category}
            className="result-category"
            data-testid={`result-category-${category}`}
          >
            <h4>
              {CATEGORY_LABELS[category]}
              <span className="result-subtotal">
                小計{" "}
                <ExpInline
                  vector={result.subtotal[category]}
                  testId={`result-subtotal-${category}`}
                />
              </span>
            </h4>
            {result[category].length === 0 ? (
              <p className="field-note">{NO_ITEM_TEXT}</p>
            ) : (
              <ul>
                {result[category].map((item) => (
                  <ItemRow key={`${item.category}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </section>

      <div className="result-actions">
        <button
          type="button"
          data-testid="export-result-csv"
          onClick={() => {
            exportResultCsv();
          }}
        >
          結果をCSVで保存
        </button>
        <button
          type="button"
          data-testid="export-result-json"
          onClick={() => {
            exportResultJson();
          }}
        >
          結果をJSONで保存
        </button>
        <button
          type="button"
          data-testid="export-plan-json"
          onClick={() => {
            exportPlanJson();
          }}
        >
          プランをJSONで保存
        </button>
      </div>
    </section>
  );
}
