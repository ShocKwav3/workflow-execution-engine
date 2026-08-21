import type { Queryable, NodeRow } from "./types.js";
import { classifyPgError } from "./errors/index.js";
import { nodeIdSchema } from "./nodeRepository.schemas.js";

export class NodeRepository {
  constructor(private readonly db: Queryable) {}

  async getNodeById(id: string): Promise<NodeRow | undefined> {
    const validId = nodeIdSchema.parse(id);

    try {
      const result = await this.db.query<NodeRow>(`SELECT * FROM node WHERE id = $1`, [validId]);

      return result.rows[0];
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
