import { z } from "zod";
import { workflowSchema } from "./workflow.schemas.js";

export const workflowVersionStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export const WORKFLOW_VERSION_STATUS = workflowVersionStatusSchema.enum;

export type WorkflowVersionStatus = z.infer<typeof workflowVersionStatusSchema>;

export const workflowVersionSchema = z.object({
  id: z.uuid(),
  workflowId: workflowSchema.shape.id,
  version: z.int32().positive(),
  status: workflowVersionStatusSchema,
});
