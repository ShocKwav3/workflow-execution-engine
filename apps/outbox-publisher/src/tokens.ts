import { createToken } from "@workflow-engine/core/di/token.js";
import type { RedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import type { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import type { OutboxPublisherConfig } from "./config.js";
import type { JobQueue } from "./queue/JobQueue.js";

export const redisConfigToken = createToken<RedisConfig>("redisConfig");

export const redisConnectionToken = createToken<RedisConnection>("redisConnection");

export const outboxPublisherConfigToken =
  createToken<OutboxPublisherConfig>("outboxPublisherConfig");

export const jobQueueToken = createToken<JobQueue>("jobQueue");
