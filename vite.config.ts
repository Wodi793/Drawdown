import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base "./" keeps every asset path relative, so the same build works at
// wodi793.github.io/drawdown/ and inside a single-file Claude artifact.
export default defineConfig({
  base: "./",
  plugins: [preact()],
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
