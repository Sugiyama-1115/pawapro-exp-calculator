/**
 * 画面 計算結果（05_ui_spec.md）。本体の実装はマイルストーン M11。
 * M9 ではタブ骨格と結果サマリーバーの常時表示を成立させるための枠のみを置く。
 */
export function ResultTab(): JSX.Element {
  return (
    <section className="tab-panel" data-testid="result-tab">
      <h2>計算結果</h2>
      <p className="tab-placeholder">この画面は M11 で実装します。</p>
    </section>
  );
}
