import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
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
          name: { label: "outbox-publisher:unit", color: "cyan" },
          include: ["apps/outbox-publisher/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: { label: "outbox-publisher:integration", color: "yellow" },
          include: ["apps/outbox-publisher/**/*.integration.test.ts"],
        },
      },
    ],
  },
});
