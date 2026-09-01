export interface LogConfig {
  logLevel: string;
  logPretty: boolean;
}

export function loadLogConfig(): LogConfig {
  return {
    logLevel: process.env.LOG_LEVEL ?? "info",
    logPretty: process.env.LOG_PRETTY === "true",
  };
}
