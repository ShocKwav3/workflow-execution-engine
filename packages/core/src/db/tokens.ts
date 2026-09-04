import type { Pool } from "pg";
import { createToken } from "@/di/token.js";
import type { WorkflowRepository } from "./workflowRepository.js";
import type { NodeRepository } from "./nodeRepository.js";
import type { WorkflowExecutionReader } from "./workflowExecutionReader.js";
import type { WorkflowExecutionUnitOfWork } from "./workflowExecutionUnitOfWork.js";
import type { NodeExecutionRepository } from "./nodeExecutionRepository.js";

// Ports, not implementations — type-only imports above, so importing a token never pulls pg in.
export const pgPoolToken = createToken<Pool>("pgPool");

export const workflowRepositoryToken = createToken<WorkflowRepository>("workflowRepository");

export const nodeRepositoryToken = createToken<NodeRepository>("nodeRepository");

export const workflowExecutionReaderToken =
  createToken<WorkflowExecutionReader>("workflowExecutionReader");

// Writers are built per transaction by the scope factory, so only the manager itself is registered.
export const workflowExecutionUnitOfWorkToken = createToken<WorkflowExecutionUnitOfWork>(
  "workflowExecutionUnitOfWork",
);

export const nodeExecutionRepositoryToken =
  createToken<NodeExecutionRepository>("nodeExecutionRepository");
