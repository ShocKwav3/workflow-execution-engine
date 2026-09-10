import { pino } from "pino";
import type { LogConfig } from "@/config/logConfig.js";
import { LOG_REDACT_PATHS } from "@/config/logging.js";
import { PINO_PRETTY_OPTIONS } from "@/config/pinoPretty.js";
import type { Logger } from "./types.js";

// Inferred return type on purpose — pino's and Fastify's logger option types do not agree.
export function createPinoOptions(config: LogConfig) {
  return {
    level: config.logLevel,
    redact: { paths: LOG_REDACT_PATHS, remove: true },
    ...(config.logPretty
      ? { transport: { target: "pino-pretty", options: PINO_PRETTY_OPTIONS } }
      : {}),
  };
}

export function createLogger(config: LogConfig): Logger {
  return pino(createPinoOptions(config));
}
