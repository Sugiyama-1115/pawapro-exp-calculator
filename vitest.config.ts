import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globals: false,
    // domain は純粋TSのためブラウザAPI不要。DOM が要るテストのみ環境を上書きする
    environment: "node",
    environmentMatchGlobs: [["tests/unit/ui/**", "jsdom"]],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts"],
      thresholds: {
        "src/domain/**": { lines: 90 },
        "src/data/**": { lines: 80 },
      },
    },
  },
});
