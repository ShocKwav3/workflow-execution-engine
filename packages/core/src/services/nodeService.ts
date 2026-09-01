import type { NodeRepository } from "@/db/nodeRepository.js";
import type {
  CreateNodeInput,
  ReorderNodesInput,
  UpdateNodeInput,
} from "@/db/nodeRepository.schemas.js";
import type { NodeRow } from "@/db/types.js";
import type { WorkflowVersionRef } from "@/db/workflowRepository.schemas.js";

export class NodeService {
  constructor(private readonly repository: NodeRepository) {}

  async getNodeById(id: string): Promise<NodeRow | undefined> {
    return this.repository.getNodeById(id);
  }

  async listNodesForVersion(input: WorkflowVersionRef): Promise<NodeRow[] | undefined> {
    return this.repository.listNodesForVersion(input);
  }

  async createNode(input: CreateNodeInput): Promise<NodeRow | undefined> {
    return this.repository.createNode(input);
  }

  async updateNode(id: string, input: UpdateNodeInput): Promise<NodeRow | undefined> {
    return this.repository.updateNode(id, input);
  }

  async deleteNode(id: string): Promise<boolean> {
    return this.repository.deleteNode(id);
  }

  async reorderNodes(input: ReorderNodesInput): Promise<NodeRow[] | undefined> {
    return this.repository.reorderNodes(input);
  }
}
