import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages のサブパス配信で 404 にしないため、資産参照は必ず相対にする
  base: "./",
  resolve: { alias: { "@": "/src" } },
  esbuild: { drop: ["console", "debugger"] },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
