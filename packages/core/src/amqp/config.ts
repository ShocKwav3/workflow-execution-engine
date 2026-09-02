import { requireEnv } from "@/config/env.js";

export interface AmqpConnectionConfig {
  url: string;
}

export function loadAmqpConnectionConfig(): AmqpConnectionConfig {
  return {
    url: requireEnv("RABBITMQ_URL"),
  };
}
