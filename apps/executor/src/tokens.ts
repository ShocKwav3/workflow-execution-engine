import { createToken } from "@workflow-engine/core/di/token.js";
import type { RedisConfig } from "@workflow-engine/core/config/redisConfig.js";
import type { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import type { ExecutorConfig } from "./config.js";
import type { StartWorkflowExecutionJob } from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import type { BullMqConsumer } from "./queue/BullMqConsumer.js";
import type { WorkflowExecutionJobHandler } from "./queue/WorkflowExecutionJobHandler.js";
import type { NodeWork } from "./run/NodeWork.js";
import type { RunOutcome, WorkflowExecutionRunner } from "./run/WorkflowExecutionRunner.js";

export const executorConfigToken = createToken<ExecutorConfig>("executorConfig");

export const redisConfigToken = createToken<RedisConfig>("redisConfig");

export const redisConnectionToken = createToken<RedisConnection>("redisConnection");

export const nodeWorkToken = createToken<NodeWork>("nodeWork");

export const workflowExecutionRunnerToken =
  createToken<WorkflowExecutionRunner>("workflowExecutionRunner");

export const workflowExecutionJobHandlerToken = createToken<WorkflowExecutionJobHandler>(
  "workflowExecutionJobHandler",
);

export const workflowExecutionConsumerToken = createToken<
  BullMqConsumer<StartWorkflowExecutionJob, RunOutcome>
>("workflowExecutionConsumer");
