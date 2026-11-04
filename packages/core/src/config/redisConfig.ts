import { readFileValue, requireEnv } from "./env.js";

export interface RedisConfig {
  url: string;
}

export function loadRedisConfig(): RedisConfig {
  return {
    // A file when the URL comes from a Kubernetes Secret.
    url: process.env.REDIS_URL_FILE
      ? readFileValue(process.env.REDIS_URL_FILE)
      : requireEnv("REDIS_URL", "e.g. redis://localhost:6379"),
  };
}
