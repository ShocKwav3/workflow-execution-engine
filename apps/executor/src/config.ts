import { positiveIntEnv } from "@workflow-engine/core/config/env.js";
import { createToken } from "@workflow-engine/core/di/token.js";

export interface ExecutorConfig {
  prefetch: number;
}

export const executorConfigToken = createToken<ExecutorConfig>("executorConfig");

export const EXECUTOR_DEFAULTS = {
  prefetch: 1,
} as const;

export function loadExecutorConfig(): ExecutorConfig {
  return {
    prefetch: positiveIntEnv("EXECUTOR_PREFETCH", EXECUTOR_DEFAULTS.prefetch),
  };
}
