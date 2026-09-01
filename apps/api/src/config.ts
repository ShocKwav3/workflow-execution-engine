import { loadLogConfig, type LogConfig } from "@workflow-engine/core/config/logConfig.js";

export interface AppConfig extends LogConfig {
  host: string;
  port: number;
}

export function loadAppConfig(): AppConfig {
  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    ...loadLogConfig(),
  };
}
