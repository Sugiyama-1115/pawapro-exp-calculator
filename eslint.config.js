import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// domain 層を UI / I/O から独立させるための import 制限（08_nonfunctional.md §4）
const DOMAIN_FORBIDDEN_IMPORTS = [
  "react",
  "react-dom",
  "zustand",
  "papaparse",
  "idb",
  "@/ui/*",
  "@/data/*",
  "@/store/*",
  "../ui/*",
  "../data/*",
  "../store/*",
  "../../ui/*",
  "../../data/*",
  "../../store/*",
];

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "playwright-report/**", "test-results/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: DOMAIN_FORBIDDEN_IMPORTS }],
    },
  },
  {
    files: ["*.ts", "*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
