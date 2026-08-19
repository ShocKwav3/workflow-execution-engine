import { z } from "zod";

// Fails predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowExecutionIdSchema = z.uuid();
