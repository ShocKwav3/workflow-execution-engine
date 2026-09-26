import type { z } from "zod";
import { workflowSchema } from "@/schemas/workflow.schemas.js";

export const createWorkflowInputSchema = workflowSchema.pick({ name: true });

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowIdSchema = workflowSchema.shape.id;
