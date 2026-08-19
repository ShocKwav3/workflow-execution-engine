export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
}

export function loadAppConfig(): AppConfig {
  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
}
