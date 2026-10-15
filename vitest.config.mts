import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/game/**", "src/modes/**"],
      // The Supabase client factories are SDK wiring; the database itself is covered by src/test/migrations.test.ts.
      exclude: ["src/**/*.test.ts", "src/lib/supabase/{admin,browser,public,server,database.types}.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
