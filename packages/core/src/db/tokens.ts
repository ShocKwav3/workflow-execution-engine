import type { Pool } from "pg";
import { createToken } from "@/di/token.js";
import type { PgPoolConfig } from "./config.js";
import type { NodeReader } from "./node/NodeReader.js";
import type { NodeUnitOfWork } from "./node/NodeUnitOfWork.js";
import type { WorkflowReader } from "./workflow/WorkflowReader.js";
import type { WorkflowUnitOfWork } from "./workflow/WorkflowUnitOfWork.js";
import type { WorkflowVersionReader } from "./workflowVersion/WorkflowVersionReader.js";
import type { WorkflowVersionUnitOfWork } from "./workflowVersion/WorkflowVersionUnitOfWork.js";
import type { WorkflowExecutionReader } from "./workflowExecution/WorkflowExecutionReader.js";
import type { WorkflowExecutionUnitOfWork } from "./workflowExecution/WorkflowExecutionUnitOfWork.js";
import type { NodeExecutionReader } from "./nodeExecution/NodeExecutionReader.js";
import type { OutboxClaimer } from "./outbox/OutboxClaimer.js";

// Ports, not implementations — type-only imports above, so importing a token never pulls pg in.
export const pgPoolConfigToken = createToken<PgPoolConfig>("pgPoolConfig");

export const pgPoolToken = createToken<Pool>("pgPool");

export const nodeReaderToken = createToken<NodeReader>("nodeReader");

export const nodeUnitOfWorkToken = createToken<NodeUnitOfWork>("nodeUnitOfWork");

export const workflowReaderToken = createToken<WorkflowReader>("workflowReader");

// Writers are built per transaction by the scope factory, so only the manager itself is registered.
export const workflowUnitOfWorkToken = createToken<WorkflowUnitOfWork>("workflowUnitOfWork");

export const workflowVersionReaderToken =
  createToken<WorkflowVersionReader>("workflowVersionReader");

export const workflowVersionUnitOfWorkToken = createToken<WorkflowVersionUnitOfWork>(
  "workflowVersionUnitOfWork",
);

export const workflowExecutionReaderToken =
  createToken<WorkflowExecutionReader>("workflowExecutionReader");

export const workflowExecutionUnitOfWorkToken = createToken<WorkflowExecutionUnitOfWork>(
  "workflowExecutionUnitOfWork",
);

export const nodeExecutionReaderToken = createToken<NodeExecutionReader>("nodeExecutionReader");

// Claiming is an UPDATE, but it runs standalone rather than inside a scope, so it gets a token.
export const outboxClaimerToken = createToken<OutboxClaimer>("outboxClaimer");
