export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  logPretty: boolean;
}

export function loadAppConfig(): AppConfig {
  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    logLevel: process.env.LOG_LEVEL ?? "info",
    logPretty: process.env.LOG_PRETTY === "true",
  };
}
