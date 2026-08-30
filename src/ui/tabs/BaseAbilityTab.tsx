/**
 * 画面 基礎能力（05_ui_spec.md）。本体の実装はマイルストーン M10。
 * M9 ではタブ骨格と結果サマリーバーの常時表示を成立させるための枠のみを置く。
 */
export function BaseAbilityTab(): JSX.Element {
  return (
    <section className="tab-panel" data-testid="base-tab">
      <h2>基礎能力</h2>
      <p className="tab-placeholder">この画面は M10 で実装します。</p>
    </section>
  );
}
