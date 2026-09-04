import type { WorkflowVersionRef } from "../workflowVersion/workflowVersion.schemas.js";
import type { NodeRow } from "../types.js";

export interface NodeReader {
  getNodeById(id: string): Promise<NodeRow | undefined>;
  listNodesForVersion(input: WorkflowVersionRef): Promise<NodeRow[] | undefined>;
}
