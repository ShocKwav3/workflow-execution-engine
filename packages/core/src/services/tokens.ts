import { createToken } from "@/di/token.js";
import type { WorkflowService } from "./workflowService.js";
import type { NodeService } from "./nodeService.js";
import type { WorkflowExecutionService } from "./workflowExecutionService.js";
import type { NodeExecutionService } from "./nodeExecutionService.js";

export const workflowServiceToken = createToken<WorkflowService>("workflowService");

export const nodeServiceToken = createToken<NodeService>("nodeService");

export const workflowExecutionServiceToken =
  createToken<WorkflowExecutionService>("workflowExecutionService");

export const nodeExecutionServiceToken = createToken<NodeExecutionService>("nodeExecutionService");
