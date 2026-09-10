import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
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
          name: { label: "integration", color: "magenta" },
          include: ["src/**/*.integration.test.ts"],
          globalSetup: [
            "../../packages/core/test/setupTestcontainersPostgres.ts",
            "../../packages/core/test/setupTestcontainersRabbitmq.ts",
          ],
        },
      },
    ],
  },
});
