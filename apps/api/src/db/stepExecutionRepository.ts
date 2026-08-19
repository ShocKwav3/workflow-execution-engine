import { createToken } from "../di/token.js";
import { classifyPgError } from "./errors.js";
import {
  type StepExecutionHistoryEntry,
  type StepHistoryQueryRow,
  groupStepHistoryRows,
} from "./helpers/executionHistoryGrouping.js";
import { workflowExecutionIdSchema } from "./stepExecutionRepository.schemas.js";
import type { Queryable, StepExecutionRow } from "./types.js";

export const stepExecutionRepositoryToken =
  createToken<StepExecutionRepository>("stepExecutionRepository");

export class StepExecutionRepository {
  constructor(private readonly db: Queryable) {}

  async getStepExecutions(workflowExecutionId: string): Promise<StepExecutionRow[]> {
    const validId = workflowExecutionIdSchema.parse(workflowExecutionId);

    try {
      const result = await this.db.query<StepExecutionRow>(
        `SELECT * FROM step_execution WHERE workflow_execution_id = $1 ORDER BY created_at`,
        [validId],
      );

      return result.rows;
    } catch (error) {
      throw classifyPgError(error);
    }
  }

  // step_execution and step_attempt share column names — aliasing avoids a silent SELECT * collision.
  async getWorkflowExecutionHistory(
    workflowExecutionId: string,
  ): Promise<StepExecutionHistoryEntry[]> {
    const validId = workflowExecutionIdSchema.parse(workflowExecutionId);

    try {
      const result = await this.db.query<StepHistoryQueryRow>(
        `SELECT
           se.id AS step_id,
           se.workflow_execution_id,
           se.step_name,
           se.status AS step_status,
           se.created_at AS step_created_at,
           se.updated_at AS step_updated_at,
           sa.id AS attempt_id,
           sa.attempt_number,
           sa.status AS attempt_status,
           sa.started_at,
           sa.finished_at,
           sa.error
         FROM step_execution se
         LEFT JOIN step_attempt sa ON sa.step_execution_id = se.id
         WHERE se.workflow_execution_id = $1
         ORDER BY se.created_at, sa.attempt_number`,
        [validId],
      );

      return groupStepHistoryRows(result.rows);
    } catch (error) {
      throw classifyPgError(error);
    }
  }
}
