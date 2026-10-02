import { requireEnv } from "./env.js";

export interface RedisConfig {
  url: string;
}

export function loadRedisConfig(): RedisConfig {
  return {
    url: requireEnv("REDIS_URL", "e.g. redis://localhost:6379"),
  };
}
