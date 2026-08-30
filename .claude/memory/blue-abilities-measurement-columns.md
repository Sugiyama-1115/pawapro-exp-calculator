---
name: blue-abilities-measurement-columns
description: blue_abilities.csv に hint_level / sense_mode 列を追加し「実測テーブル化」する決定（2026-08-30）
metadata:
  type: project
---

2026-08-30、実装着手前にユーザーの指摘で `blue_abilities.csv` の記録条件カラム欠落が判明し、実測テーブル化を採用した。

**Why:** 原仕様は「コツLv0・センス補正なし」を文章でのみ宣言しており、センス○/コツ所持状態で測った値が混入しても検証で検出できず、青特の倍率モデル（config の単一係数 0.90）を実測で検算する手段も無かった。金特 (`gold_abilities.csv`) は同じ列を持っており、青特だけ非対称だった。

**How to apply:** 一意キーは `(ability_id, player_type, from_state, hint_level, sense_mode)`。各遷移に基準行（`hint_level=0` / `sense_mode=normal`）が必須（検証ルール V-27）。計算は2段階 — ①区間の全遷移が (コツLv, センス) に完全一致すれば倍率・丸めなしでそのまま合計 (`source="measured"`) ②1つでも欠ければ区間全体を基準行 × コツ倍率 × センス倍率で計算 (`source="master"`)。**遷移単位での混在は禁止**（丸め位置が実装依存になるため）。改訂済み: docs/03 §6・V-27、docs/04 §4・blueKey、docs/11 UT-BLUE-13〜17 / UT-VAL-09a〜d、public/data/sample2024/blue_abilities.csv。

なお `gold_abilities.csv` の「下位青特取得済み」前提は、ユーザー判断により列追加せず docs の運用注記のままとした。
