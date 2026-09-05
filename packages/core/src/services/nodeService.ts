import type { NodeReader } from "@/db/node/NodeReader.js";
import type { NodeUnitOfWork } from "@/db/node/NodeUnitOfWork.js";
import type {
  CreateNodeInput,
  ReorderNodesInput,
  UpdateNodeInput,
} from "@/db/node/node.schemas.js";
import type { NodeRow } from "@/db/types.js";
import type { WorkflowVersionRef } from "@/db/workflowVersion/workflowVersion.schemas.js";

export class NodeService {
  constructor(
    private readonly nodes: NodeReader,
    private readonly unitOfWork: NodeUnitOfWork,
  ) {}

  async getNodeById(id: string): Promise<NodeRow | undefined> {
    return this.nodes.getNodeById(id);
  }

  async listNodesForVersion(input: WorkflowVersionRef): Promise<NodeRow[] | undefined> {
    return this.nodes.listNodesForVersion(input);
  }

  async createNode(input: CreateNodeInput): Promise<NodeRow | undefined> {
    return this.unitOfWork.run((scope) => scope.nodes.createNode(input));
  }

  async updateNode(id: string, input: UpdateNodeInput): Promise<NodeRow | undefined> {
    return this.unitOfWork.run((scope) => scope.nodes.updateNode(id, input));
  }

  async deleteNode(id: string): Promise<boolean> {
    return this.unitOfWork.run((scope) => scope.nodes.deleteNode(id));
  }

  async reorderNodes(input: ReorderNodesInput): Promise<NodeRow[] | undefined> {
    return this.unitOfWork.run((scope) => scope.nodes.reorderNodes(input));
  }
}
