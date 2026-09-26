import { z } from "zod";
import { workflowVersionSchema } from "./workflowVersion.schemas.js";

// Strict at every level so each new config field is a deliberate addition, never silently accepted.
export const nodeConfigSchema = z.strictObject({
  durationSeconds: z.int32().nonnegative().optional(),
  crash: z
    .strictObject({
      duringRetry: z.int32().nonnegative().optional(),
    })
    .optional(),
});

export type NodeConfig = z.infer<typeof nodeConfigSchema>;

export const nodeSchema = z.object({
  id: z.uuid(),
  workflowVersionId: workflowVersionSchema.shape.id,
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  sequence: z.int32(),
  config: nodeConfigSchema,
});
