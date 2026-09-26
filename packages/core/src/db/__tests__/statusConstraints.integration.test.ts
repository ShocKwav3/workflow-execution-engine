import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { seedPublishedVersion, workflowExecutionUnitOfWorkFor } from "@core-test/fixtures.js";

const CHECK_VIOLATION = "23514";

describe("status check constraints", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function seedExecution() {
    const { workflow, version } = await seedPublishedVersion(db.pool, [
      { name: "Reserve inventory", type: "inventory.reserve" },
    ]);
    const { execution } = await workflowExecutionUnitOfWorkFor(db.pool).run(
      ({ workflowExecutions }) =>
        workflowExecutions.createWorkflowExecution({
          workflowId: workflow.id,
          workflowVersionId: version.id,
        }),
    );

    return { version, execution };
  }

  it("rejects an unknown workflow version status", async () => {
    const { version } = await seedExecution();

    await expect(
      db.pool.query("UPDATE workflow_version SET status = 'ARCHIVED' WHERE id = $1", [version.id]),
    ).rejects.toMatchObject({
      code: CHECK_VIOLATION,
      constraint: "workflow_version_status_check",
    });
  });

  it("rejects an unknown workflow execution status, including the retired PENDING", async () => {
    const { execution } = await seedExecution();

    await expect(
      db.pool.query("UPDATE workflow_execution SET status = 'PENDING' WHERE id = $1", [
        execution.id,
      ]),
    ).rejects.toMatchObject({
      code: CHECK_VIOLATION,
      constraint: "workflow_execution_status_check",
    });
  });

  it("rejects an unknown node execution status", async () => {
    const { execution } = await seedExecution();

    await expect(
      db.pool.query(
        "UPDATE node_execution SET status = 'CREATED' WHERE workflow_execution_id = $1",
        [execution.id],
      ),
    ).rejects.toMatchObject({
      code: CHECK_VIOLATION,
      constraint: "node_execution_status_check",
    });
  });

  it("accepts every known status transition target", async () => {
    const { execution } = await seedExecution();

    await db.pool.query("UPDATE workflow_execution SET status = 'RUNNING' WHERE id = $1", [
      execution.id,
    ]);
    await db.pool.query(
      "UPDATE node_execution SET status = 'COMPLETED' WHERE workflow_execution_id = $1",
      [execution.id],
    );
  });
});
