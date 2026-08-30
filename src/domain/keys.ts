/**
 * 一意キー生成（04_calculation_spec.md §10）。区切り文字はパイプ固定。
 * data 層の keyBuilder はこの実装を再輸出する。domain から data へ依存させないため domain に置く。
 */
export const baseKey = (playerType: string, abilityId: string, fromValue: number): string =>
  `${playerType}|${abilityId}|${fromValue}`;

export const blueKey = (
  abilityId: string,
  playerType: string,
  fromState: string,
  hintLevel: number,
  senseMode: string,
): string => `${abilityId}|${playerType}|${fromState}|${hintLevel}|${senseMode}`;

export const goldKey = (
  abilityId: string,
  playerType: string,
  hintLevel: number,
  senseMode: string,
): string => `${abilityId}|${playerType}|${hintLevel}|${senseMode}`;

export const hintKey = (abilityType: string, hintLevel: number): string =>
  `${abilityType}|${hintLevel}`;

export const breakingKey = (
  pitchType: string,
  fromLevel: number,
  totalBreakBefore: number,
  pitchCountBefore: number,
): string => `${pitchType}|${fromLevel}|${totalBreakBefore}|${pitchCountBefore}`;

export const baseDefKey = (playerType: string, abilityId: string): string =>
  `${playerType}|${abilityId}`;

export const goldByAbilityKey = (abilityId: string, senseMode: string): string =>
  `${abilityId}|${senseMode}`;
