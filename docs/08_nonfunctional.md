# 08. 非機能要件・ビルド・デプロイ・コーディング規約

---

## 1. 非機能要件

| 分類 | 項目 | 要求値 |
|---|---|---|
| 性能 | 初回表示（サンプルデータ） | 2秒以内 |
| 性能 | CSVロード（合計50,000行） | 3秒以内 |
| 性能 | 再計算1回 | 100ms以内 |
| 性能 | 金特推定（1能力・5カテゴリ） | 10ms以内 |
| 性能 | バンドルサイズ（gzip後、JS合計） | 400KB以下 |
| 可用性 | サーバー依存 | なし。静的ファイルのみで動作すること |
| 互換性 | 対応ブラウザ | Google Chrome / Microsoft Edge 最新版および1つ前のメジャー版 |
| 互換性 | 非対応 | Safari / Firefox / モバイルブラウザ（動作保証しない。動いてもよい） |
| 互換性 | 対応画面幅 | 1280px以上 |
| セキュリティ | 外部通信 | **一切行わない**（CDN・フォント・解析を含む） |
| セキュリティ | 認証・個人情報 | 取り扱わない |
| セキュリティ | 依存ライセンス | MIT / Apache-2.0 / BSD / ISC のみ。GPL系は不可 |
| 保守性 | 型チェック | `tsc --noEmit` がエラー0 |
| 保守性 | Lint | ESLint エラー0・警告0 |
| 保守性 | テストカバレッジ | `src/domain/` の行カバレッジ **90%以上**（必須）、`src/data/` 80%以上 |
| 保守性 | 新作対応 | `public/data/` へのCSV追加と `games.json` の1行追加のみで対応できること |
| 国際化 | 対応言語 | 日本語のみ |

---

## 2. 依存パッケージ（確定）

| パッケージ | バージョン指定 | 用途 |
|---|---|---|
| `react` / `react-dom` | `^18.3` | UI |
| `typescript` | `^5.5` | 言語 |
| `vite` | `^5.4` | ビルド |
| `@vitejs/plugin-react` | `^4.3` | React対応 |
| `zustand` | `^4.5` | 状態管理 |
| `papaparse` / `@types/papaparse` | `^5.4` | CSVパース |
| `idb` | `^8.0` | IndexedDB |
| `vitest` | `^2.0` | 単体テスト |
| `@vitest/coverage-v8` | `^2.0` | カバレッジ |
| `@testing-library/react` / `@testing-library/user-event` | 最新安定版 | コンポーネントテスト |
| `jsdom` | 最新安定版 | テスト環境 |
| `@playwright/test` | `^1.47` | E2E |
| `eslint` / `typescript-eslint` / `eslint-plugin-react-hooks` | 最新安定版 | Lint |
| `prettier` | `^3.3` | フォーマット |

**上記以外のランタイム依存を追加してはならない。** UIコンポーネントライブラリ・CSSフレームワーク・日付ライブラリ・ユーティリティライブラリ（lodash等）は追加不可。CSSは素の CSS Modules を使用する。

---

## 3. TypeScript 設定

`tsconfig.json` の必須項目。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

`any` の使用を禁止する（`@typescript-eslint/no-explicit-any` を `error`）。外部由来の未検証データは `unknown` で受け、検証関数を通して型を確定させる。

---

## 4. Lint ルール（必須）

`eslint.config.js` に以下を含めること。

| ルール | 設定 | 目的 |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | error | 型安全 |
| `@typescript-eslint/no-floating-promises` | error | 非同期処理の取りこぼし防止 |
| `no-console` | error（`console.error` のみ warn） | 07章 §6 |
| `import/no-restricted-paths` 相当の自作ルール | error | **`src/domain/` から `react` / `zustand` / `papaparse` / `idb` / `src/ui` / `src/data` / `src/store` への import を禁止** |
| `eslint-plugin-react-hooks` の推奨セット | error | Hooks 規約 |

依存方向の検査は CI で必ず実行すること（`02_architecture.md` §1 の禁止事項）。
専用プラグインを追加しない方針のため、`no-restricted-imports` で以下を設定する。

```js
// src/domain/** に適用する override
"no-restricted-imports": ["error", {
  patterns: ["react", "react-dom", "zustand", "papaparse", "idb",
             "@/ui/*", "@/data/*", "@/store/*",
             "../ui/*", "../data/*", "../store/*",
             "../../ui/*", "../../data/*", "../../store/*"]
}]
```

---

## 5. コーディング規約

| 対象 | 規約 | 例 |
|---|---|---|
| ファイル名（React コンポーネント） | PascalCase + `.tsx` | `ResultSummaryBar.tsx` |
| ファイル名（それ以外） | camelCase + `.ts` | `baseCalculator.ts` |
| ディレクトリ名 | camelCase | `csvLoader` |
| 型・インターフェース | PascalCase。`I` 接頭辞を付けない | `ExpVector` |
| 関数・変数 | camelCase | `calculateBaseAbility` |
| 定数 | UPPER_SNAKE_CASE | `RANK_STATES` |
| ゲームデータのID | snake_case（CSV由来のためそのまま） | `power_hitter` |
| エラーコード | UPPER_SNAKE_CASE | `BASE_DATA_MISSING` |
| CSVカラム名 | snake_case | `from_value` |
| TSプロパティ名 | camelCase（CSV読込時に変換する） | `fromValue` |
| インデント | スペース2 | — |
| 行長 | 100文字（Prettier `printWidth: 100`） | — |
| セミコロン | 付ける | — |
| クォート | ダブルクォート | — |
| コメント | 日本語可。**なぜそうするか**を書く。何をしているかの逐語訳は書かない | — |

CSV のカラム名（snake_case）と TypeScript のプロパティ名（camelCase）の変換は
`data/csv/schemas.ts` の1箇所に集約し、他所で `row["from_value"]` のような文字列アクセスをしない。

---

## 6. npm スクリプト（確定）

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "verify": "npm run lint && npm run typecheck && npm run test:cov && npm run e2e"
  }
}
```

`npm run verify` がすべて成功することを、コミット可能な状態の定義とする。

---

## 7. ビルド設定

`vite.config.ts` の必須項目。

```ts
export default defineConfig({
  plugins: [react()],
  base: "./",                 // GitHub Pages のサブパス配信に対応するため相対パス
  resolve: { alias: { "@": "/src" } },
  esbuild: { drop: ["console", "debugger"] },  // 本番ビルドからログを除去
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
```

- `base: "./"` は必須。`https://<user>.github.io/<repo>/` 配下で動作させるため。
- CSVは `public/data/` に置き、実行時に `fetch(new URL("./data/...", document.baseURI))` で相対取得する。
  **絶対パス `/data/...` を使ってはならない**（サブパス配信で404になる）。

---

## 8. CI（GitHub Actions）

### `.github/workflows/ci.yml`

| ジョブ | 実行内容 | トリガ |
|---|---|---|
| `verify` | `npm ci` → `lint` → `typecheck` → `test:cov` → Playwright ブラウザ導入 → `e2e` | push（全ブランチ）/ pull_request |

- Node.js は LTS（20.x 以上）を使用する。
- カバレッジが `src/domain/` 90% を下回った場合、ジョブを失敗させる（`vitest.config.ts` の `coverage.thresholds` で設定）。

### `.github/workflows/deploy.yml`

| ジョブ | 実行内容 | トリガ |
|---|---|---|
| `deploy` | `npm ci` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages` | `main` への push |

- リポジトリ設定で GitHub Pages のソースを「GitHub Actions」にすること。
- `public/data/pawapro2024/` は Git 管理外のため、**デプロイされる成果物にはサンプルデータのみが含まれる**。
  公開URLでの利用時、実データはユーザーがCSVインポート機能で読み込む。

---

## 9. リポジトリ運用

| 項目 | 規定 |
|---|---|
| 公開範囲 | public |
| ブランチ | `main` を保護。作業は feature ブランチ → Pull Request |
| コミットメッセージ | 1行目に変更内容を日本語で簡潔に。形式は自由 |
| 実測データ | `.gitignore` により除外。**誤ってコミットしないこと** |
| 生成物 | `dist/`, `node_modules/`, `coverage/`, `playwright-report/`, `test-results/` を除外 |

### `.gitignore`（確定内容）

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.vite/
*.local

# 実測データCSV（公開しない）
public/data/*/
!public/data/sample2024/
```

---

## 10. 受け渡し成果物

委託先が納品する成果物を以下とする。

| No | 成果物 | 形式 |
|---|---|---|
| 1 | ソースコード一式 | Git リポジトリ |
| 2 | ビルド成果物 | `dist/`（再現手順があれば省略可） |
| 3 | サンプルCSVデータ | `public/data/sample2024/` |
| 4 | 単体テストコード | `tests/unit/` |
| 5 | E2Eテストコード | `tests/e2e/` |
| 6 | 単体テスト実行結果 | カバレッジレポート（HTML） |
| 7 | 手動UI試験結果 | `12_ui_test_spec.md` の判定欄を埋めたもの |
| 8 | 受け入れ試験結果 | `14_acceptance_test.md` の判定欄を埋めたもの |
| 9 | セットアップ手順 | `README.md` |
