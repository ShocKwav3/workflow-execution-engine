import { z } from "zod";

export const workflowSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
});
