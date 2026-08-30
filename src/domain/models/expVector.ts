/**
 * 経験点ベクトル。5カテゴリの並び順は 00_index.md §4 で固定されており変更してはならない。
 */
export interface ExpVector {
  muscle: number;
  agility: number;
  technique: number;
  breaking: number;
  mental: number;
}

export const EXP_KEYS = ["muscle", "agility", "technique", "breaking", "mental"] as const;
export type ExpKey = (typeof EXP_KEYS)[number];

export function zeroVector(): ExpVector {
  return { muscle: 0, agility: 0, technique: 0, breaking: 0, mental: 0 };
}

export function addVector(a: ExpVector, b: ExpVector): ExpVector {
  return {
    muscle: a.muscle + b.muscle,
    agility: a.agility + b.agility,
    technique: a.technique + b.technique,
    breaking: a.breaking + b.breaking,
    mental: a.mental + b.mental,
  };
}

export function sumVectors(list: ExpVector[]): ExpVector {
  return list.reduce<ExpVector>((acc, v) => addVector(acc, v), zeroVector());
}

export function isZeroVector(v: ExpVector): boolean {
  return EXP_KEYS.every((k) => v[k] === 0);
}

export function totalOf(v: ExpVector): number {
  return EXP_KEYS.reduce((sum, k) => sum + v[k], 0);
}
