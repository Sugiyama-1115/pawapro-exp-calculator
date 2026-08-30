/**
 * 画面 特殊能力（05_ui_spec.md）。本体の実装はマイルストーン M10。
 * M9 ではタブ骨格と結果サマリーバーの常時表示を成立させるための枠のみを置く。
 */
export function SpecialAbilityTab(): JSX.Element {
  return (
    <section className="tab-panel" data-testid="special-tab">
      <h2>特殊能力</h2>
      <p className="tab-placeholder">この画面は M10 で実装します。</p>
    </section>
  );
}
