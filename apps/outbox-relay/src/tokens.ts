import { createToken } from "@workflow-engine/core/di/token.js";
import type { RedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import type { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import type { OutboxRelayConfig } from "./config.js";
import type { OutboxRelay } from "./OutboxRelay.js";
import type { Poller } from "./poller.js";
import type { JobQueue } from "./queue/JobQueue.js";

export const redisConfigToken = createToken<RedisConfig>("redisConfig");

export const redisConnectionToken = createToken<RedisConnection>("redisConnection");

export const outboxRelayConfigToken = createToken<OutboxRelayConfig>("outboxRelayConfig");

export const jobQueueToken = createToken<JobQueue>("jobQueue");

export const outboxRelayToken = createToken<OutboxRelay>("outboxRelay");

export const pollerToken = createToken<Poller>("poller");
