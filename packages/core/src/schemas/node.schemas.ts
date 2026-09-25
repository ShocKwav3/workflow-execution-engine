import { z } from "zod";
import { workflowVersionSchema } from "./workflowVersion.schemas.js";

export const nodeSchema = z.object({
  id: z.uuid(),
  workflowVersionId: workflowVersionSchema.shape.id,
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  sequence: z.int32(),
});
