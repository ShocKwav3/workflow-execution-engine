import { createToken } from "../di/token.js";
import type { WorkflowRepository } from "./workflowRepository.js";
import type { WorkflowExecutionRepository } from "./workflowExecutionRepository.js";
import type { StepExecutionRepository } from "./stepExecutionRepository.js";

// Ports, not implementations — only type-only imports above, so importing a token
// never pulls pg (or anything else the implementation needs) into the caller's graph.
export const workflowRepositoryToken = createToken<WorkflowRepository>("workflowRepository");

export const workflowExecutionRepositoryToken = createToken<WorkflowExecutionRepository>(
  "workflowExecutionRepository",
);

export const stepExecutionRepositoryToken =
  createToken<StepExecutionRepository>("stepExecutionRepository");
