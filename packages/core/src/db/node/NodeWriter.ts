import type { CreateNodeInput, ReorderNodesInput, UpdateNodeInput } from "./node.schemas.js";
import type { NodeRow } from "../types.js";

export interface NodeWriter {
  createNode(input: CreateNodeInput): Promise<NodeRow | undefined>;
  updateNode(id: string, input: UpdateNodeInput): Promise<NodeRow | undefined>;
  deleteNode(id: string): Promise<boolean>;
  reorderNodes(input: ReorderNodesInput): Promise<NodeRow[] | undefined>;
}
