import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StepExecutionRepository } from "../stepExecutionRepository.js";
import { WorkflowExecutionRepository } from "../workflowExecutionRepository.js";
import { WorkflowRepository } from "../workflowRepository.js";
import { createWorkflowWithVersion } from "./fixtures.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "./testDatabase.js";

describe("StepExecutionRepository", () => {
  let db: TestDatabase;
  let repo: StepExecutionRepository;
  let executionRepo: WorkflowExecutionRepository;
  let workflowRepo: WorkflowRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repo = new StepExecutionRepository(db.pool);
    executionRepo = new WorkflowExecutionRepository(db.pool);
    workflowRepo = new WorkflowRepository(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function createExecutionWithSteps() {
    const { workflow, version, definition } = await createWorkflowWithVersion(workflowRepo);
    const execution = await executionRepo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    return { execution, definition };
  }

  it("returns the step_execution snapshot in creation order", async () => {
    const { execution, definition } = await createExecutionWithSteps();

    const steps = await repo.getStepExecutions(execution.id);

    expect(steps.map((s) => s.step_name)).toEqual(definition.map((s) => s.name));
  });

  it("returns an empty array for an execution with no steps", async () => {
    const { workflow, version } = await createWorkflowWithVersion(workflowRepo, []);
    const execution = await executionRepo.createWorkflowExecution({
      workflowId: workflow.id,
      workflowVersionId: version.id,
    });

    const steps = await repo.getStepExecutions(execution.id);

    expect(steps).toEqual([]);
  });

  it("rejects fetching steps with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getStepExecutions("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("returns execution history with steps and empty attempts, since nothing has executed yet", async () => {
    const { execution, definition } = await createExecutionWithSteps();

    const history = await repo.getWorkflowExecutionHistory(execution.id);

    expect(history).toHaveLength(definition.length);
    expect(history.every((entry) => entry.attempts.length === 0)).toBe(true);
  });

  it("rejects fetching history with a malformed workflowExecutionId", async () => {
    const getMalformed = repo.getWorkflowExecutionHistory("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });
});
