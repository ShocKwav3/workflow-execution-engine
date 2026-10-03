import type { z } from "zod";
import { workflowSchema } from "@/schemas/workflow.schemas.js";

export const createWorkflowInputSchema = workflowSchema.pick({ name: true });

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;
