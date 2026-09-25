import { z } from "zod";
import { WORKFLOW_VERSION_STATUSES } from "@/db/types.js";
import { workflowSchema } from "./workflow.schemas.js";

export const workflowVersionSchema = z.object({
  id: z.uuid(),
  workflowId: workflowSchema.shape.id,
  version: z.int32().positive(),
  status: z.enum(WORKFLOW_VERSION_STATUSES),
});
