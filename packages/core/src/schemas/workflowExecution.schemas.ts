import { z } from "zod";
import { workflowSchema } from "./workflow.schemas.js";
import { workflowVersionSchema } from "./workflowVersion.schemas.js";

export const workflowExecutionSchema = z.object({
  id: z.uuid(),
  workflowId: workflowSchema.shape.id,
  workflowVersionId: workflowVersionSchema.shape.id,
  idempotencyKey: z.string().trim().min(1),
});
