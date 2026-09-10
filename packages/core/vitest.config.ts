import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: { label: "unit", color: "cyan" },
          include: ["src/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "integration", color: "blue" },
          include: ["src/**/*.integration.test.ts"],
          globalSetup: ["./test/globalSetup.ts"],
        },
      },
    ],
  },
});
