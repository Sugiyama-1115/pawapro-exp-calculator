/**
 * 一意キー生成（04_calculation_spec.md §10）。
 * 実体は domain 側（`@/domain/keys`）にあり、data 層はそれを再輸出する。
 * domain が data に依存しないようにしつつ、キー形式を1箇所に保つため。
 */
export {
  baseDefKey,
  baseKey,
  blueKey,
  breakingKey,
  goldByAbilityKey,
  goldKey,
  hintKey,
} from "@/domain/keys";
