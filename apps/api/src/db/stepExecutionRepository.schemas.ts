import { z } from "zod";

// Lookup-key shape check — same reasoning as workflowIdSchema/executionIdSchema:
// fail predictably on a malformed id instead of leaking a raw Postgres type-cast error.
export const workflowExecutionIdSchema = z.uuid();
