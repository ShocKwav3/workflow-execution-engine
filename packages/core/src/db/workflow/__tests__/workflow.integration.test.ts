import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTransactionRunner } from "@/db/transaction.js";
import { PgWorkflowReader } from "@/db/workflow/PgWorkflowReader.js";
import { PgWorkflowWriter } from "@/db/workflow/PgWorkflowWriter.js";
import type { WorkflowUnitOfWork } from "@/db/workflow/WorkflowUnitOfWork.js";
import type { CreateWorkflowInput } from "@/db/workflow/workflow.schemas.js";
import type { WorkflowRow } from "@/db/types.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";

describe("workflow persistence", () => {
  let db: TestDatabase;
  let reader: PgWorkflowReader;
  let unitOfWork: WorkflowUnitOfWork;

  const createWorkflow = (input: CreateWorkflowInput): Promise<WorkflowRow> =>
    unitOfWork.run(({ workflows }) => workflows.createWorkflow(input));

  beforeAll(async () => {
    db = await startTestDatabase();
    reader = new PgWorkflowReader(db.pool);
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      workflows: new PgWorkflowWriter(client),
    }));
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  it("creates and fetches a workflow", async () => {
    const created = await createWorkflow({ name: "Order Fulfillment" });

    const fetched = await reader.getWorkflowById(created.id);

    expect(fetched).toEqual(created);
    expect(created.name).toBe("Order Fulfillment");
  });

  it("rejects creating a workflow with an empty name", async () => {
    const createEmpty = createWorkflow({ name: "  " });

    await expect(createEmpty).rejects.toThrow(ZodError);
  });

  it("returns undefined when fetching a workflow that doesn't exist", async () => {
    const fetched = await reader.getWorkflowById("00000000-0000-0000-0000-000000000000");

    expect(fetched).toBeUndefined();
  });

  it("rejects fetching a workflow with a malformed id instead of leaking a raw DB error", async () => {
    const getMalformed = reader.getWorkflowById("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("lists all created workflows", async () => {
    await createWorkflow({ name: "Workflow A" });
    await createWorkflow({ name: "Workflow B" });

    const workflows = await reader.listWorkflows();

    expect(workflows).toHaveLength(2);
    expect(workflows.map((w) => w.name)).toEqual(["Workflow A", "Workflow B"]);
  });
});
