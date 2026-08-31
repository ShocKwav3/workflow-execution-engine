import type { Pool } from "pg";
import { createToken } from "@/di/token.js";
import type { WorkflowRepository } from "./workflowRepository.js";
import type { NodeRepository } from "./nodeRepository.js";
import type { WorkflowExecutionRepository } from "./workflowExecutionRepository.js";
import type { NodeExecutionRepository } from "./nodeExecutionRepository.js";

// Ports, not implementations — type-only imports above, so importing a token never pulls pg in.
export const pgPoolToken = createToken<Pool>("pgPool");

export const workflowRepositoryToken = createToken<WorkflowRepository>("workflowRepository");

export const nodeRepositoryToken = createToken<NodeRepository>("nodeRepository");

export const workflowExecutionRepositoryToken = createToken<WorkflowExecutionRepository>(
  "workflowExecutionRepository",
);

export const nodeExecutionRepositoryToken =
  createToken<NodeExecutionRepository>("nodeExecutionRepository");
