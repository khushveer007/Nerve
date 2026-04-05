import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/test/**/*.test.ts"],
    globals: true,
    testTimeout: 30_000,
  },
});
