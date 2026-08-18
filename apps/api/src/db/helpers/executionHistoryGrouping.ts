import type { StepAttemptRow, StepExecutionRow } from "../types.js";

export interface StepExecutionHistoryEntry {
  step: StepExecutionRow;
  attempts: StepAttemptRow[];
}

export interface StepHistoryQueryRow {
  step_id: string;
  workflow_execution_id: string;
  step_name: string;
  step_status: string;
  step_created_at: Date;
  step_updated_at: Date;
  attempt_id: string | null;
  attempt_number: number | null;
  attempt_status: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}

// Pure transformation, no I/O — reshapes flat joined rows (one row per attempt, or
// one row with null attempt columns if a step has none yet) into nested step/attempts
// entries. Kept separate from workflowExecutionRepository.ts so it's unit-testable with plain
// objects, without needing a real database or a repository instance.
export function groupStepHistoryRows(rows: StepHistoryQueryRow[]): StepExecutionHistoryEntry[] {
  const stepsById = new Map<string, StepExecutionHistoryEntry>();

  for (const row of rows) {
    let entry = stepsById.get(row.step_id);

    if (!entry) {
      entry = {
        step: {
          id: row.step_id,
          workflow_execution_id: row.workflow_execution_id,
          step_name: row.step_name,
          status: row.step_status,
          created_at: row.step_created_at,
          updated_at: row.step_updated_at,
        },
        attempts: [],
      };
      stepsById.set(row.step_id, entry);
    }

    if (row.attempt_id) {
      entry.attempts.push({
        id: row.attempt_id,
        step_execution_id: row.step_id,
        attempt_number: row.attempt_number!,
        status: row.attempt_status!,
        started_at: row.started_at,
        finished_at: row.finished_at,
        error: row.error,
      });
    }
  }

  return [...stepsById.values()];
}
