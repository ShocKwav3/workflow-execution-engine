import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: "./packages/core/test/globalSetup.ts",
    projects: [
      {
        extends: true,
        test: {
          name: { label: "core:unit", color: "cyan" },
          include: ["packages/core/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "core:integration", color: "blue" },
          include: ["packages/core/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "api:unit", color: "cyan" },
          include: ["apps/api/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "api:integration", color: "magenta" },
          include: ["apps/api/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "outboxPublisher:unit", color: "cyan" },
          include: ["apps/outboxPublisher/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "outboxPublisher:integration", color: "magenta" },
          include: ["apps/outboxPublisher/**/*.integration.test.ts"],
        },
      },
    ],
  },
});
