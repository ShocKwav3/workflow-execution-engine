export const V1_PREFIX = "/api/v1";

export const TAGS = {
  WORKFLOWS: { name: "Workflows", description: "Workflow definitions." },
  WORKFLOW_VERSIONS: {
    name: "WorkflowVersions",
    description: "Draft and published versions of a workflow.",
  },
  NODES: { name: "Nodes", description: "Steps belonging to a workflow version." },
  WORKFLOW_EXECUTIONS: {
    name: "WorkflowExecutions",
    description: "Runs of a published workflow version.",
  },
  NODE_EXECUTIONS: {
    name: "NodeExecutions",
    description: "Per-node results of a workflow execution.",
  },
} as const;
