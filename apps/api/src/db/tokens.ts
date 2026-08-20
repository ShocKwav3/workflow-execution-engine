import type { Pool } from "pg";
import { createToken } from "../di/token.js";
import type { WorkflowRepository } from "./workflowRepository.js";
import type { WorkflowExecutionRepository } from "./workflowExecutionRepository.js";
import type { StepExecutionRepository } from "./stepExecutionRepository.js";

// Ports, not implementations — type-only imports above, so importing a token never pulls pg in.
export const pgPoolToken = createToken<Pool>("pgPool");

export const workflowRepositoryToken = createToken<WorkflowRepository>("workflowRepository");

export const workflowExecutionRepositoryToken = createToken<WorkflowExecutionRepository>(
  "workflowExecutionRepository",
);

export const stepExecutionRepositoryToken =
  createToken<StepExecutionRepository>("stepExecutionRepository");
