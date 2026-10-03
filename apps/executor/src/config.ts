import { positiveIntEnv } from "@workflow-engine/core/config/env.js";

export interface ExecutorConfig {
  concurrency: number;
}

export const EXECUTOR_DEFAULTS = {
  concurrency: 1,
} as const;

export function loadExecutorConfig(): ExecutorConfig {
  return {
    concurrency: positiveIntEnv("EXECUTOR_CONCURRENCY", EXECUTOR_DEFAULTS.concurrency),
  };
}
