---
name: keybuilder-lives-in-domain
description: キー生成関数の実体は src/domain/keys.ts に置き、data 層の keyBuilder は再輸出にする決定
metadata:
  type: project
---

`04_calculation_spec.md` §10 はキー生成関数を `data/repositories/keyBuilder.ts` に置くと書いているが、
domain の計算器（baseCalculator / blueCalculator / goldCalculator / breakingCalculator）がこれらを使うため、
実体は `src/domain/keys.ts` に置いた。M6 で作る `data/repositories/keyBuilder.ts` は
`src/domain/keys.ts` を再輸出するだけの薄いモジュールにすること（UT-KEY はそちら経由で検証する）。

**Why:** `08_nonfunctional.md` §4 の Lint ルールが `src/domain/**` から `@/data/*` への import を禁止しており、
仕様どおり data 層に実体を置くと domain がビルドできない。

**How to apply:** キー形式（区切り文字 `|`、`to_value` を含めない）は仕様どおり。追加のキーが必要になったら
`src/domain/keys.ts` に足し、data 層からは再輸出のみ行う。関連: [[blue-abilities-measurement-columns]]
