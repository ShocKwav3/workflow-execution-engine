import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UniqueConstraintViolationError } from "@/db/errors/index.js";
import {
  VersionAlreadyPublishedError,
  VersionHasNoNodesError,
  VersionNotDraftError,
} from "@/errors/domain/index.js";
import { createTransactionRunner } from "@/db/transaction.js";
import { PgWorkflowVersionReader } from "@/db/workflowVersion/PgWorkflowVersionReader.js";
import { PgWorkflowVersionWriter } from "@/db/workflowVersion/PgWorkflowVersionWriter.js";
import type { WorkflowVersionUnitOfWork } from "@/db/workflowVersion/WorkflowVersionUnitOfWork.js";
import type {
  CreateWorkflowVersionInput,
  WorkflowVersionRef,
} from "@/db/workflowVersion/workflowVersion.schemas.js";
import type { WorkflowVersionRow } from "@/db/types.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { nodeUnitOfWorkFor, workflowUnitOfWorkFor } from "@core-test/fixtures.js";

describe("workflow version persistence", () => {
  let db: TestDatabase;
  let reader: PgWorkflowVersionReader;
  let unitOfWork: WorkflowVersionUnitOfWork;

  const createWorkflow = (name: string) =>
    workflowUnitOfWorkFor(db.pool).run(({ workflows }) => workflows.createWorkflow({ name }));

  const createVersion = (input: CreateWorkflowVersionInput): Promise<WorkflowVersionRow> =>
    unitOfWork.run(({ workflowVersions }) => workflowVersions.createWorkflowVersion(input));

  const publishVersion = (input: WorkflowVersionRef): Promise<WorkflowVersionRow | undefined> =>
    unitOfWork.run(({ workflowVersions }) => workflowVersions.publishWorkflowVersion(input));

  const deleteVersion = (input: WorkflowVersionRef): Promise<boolean> =>
    unitOfWork.run(({ workflowVersions }) => workflowVersions.deleteWorkflowVersion(input));

  beforeAll(async () => {
    db = await startTestDatabase();
    reader = new PgWorkflowVersionReader(db.pool);
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      workflowVersions: new PgWorkflowVersionWriter(client),
    }));
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function draftWithNode(name = "Order Fulfillment") {
    const workflow = await createWorkflow(name);
    const version = await createVersion({ workflowId: workflow.id, version: 1 });

    await nodeUnitOfWorkFor(db.pool).run(({ nodes }) =>
      nodes.createNode({
        workflowId: workflow.id,
        version: version.id,
        name: "Reserve Inventory",
        type: "inventory",
      }),
    );

    return { workflow, version };
  }

  it("creates a workflow version as an empty draft", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const created = await createVersion({ workflowId: workflow.id, version: 1 });
    const fetched = await reader.getWorkflowVersion({
      workflowId: workflow.id,
      version: created.id,
    });

    expect(created.status).toBe("DRAFT");
    expect(created.published_at).toBeNull();
    expect(fetched).toEqual(created);
  });

  it("rejects creating a workflow version with an invalid workflowId", async () => {
    const createInvalid = createVersion({ workflowId: "not-a-uuid", version: 1 });

    await expect(createInvalid).rejects.toThrow(ZodError);
  });

  it("rejects creating a workflow version with a non-positive version number", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const createInvalid = createVersion({ workflowId: workflow.id, version: 0 });

    await expect(createInvalid).rejects.toThrow(ZodError);
  });

  it("returns undefined when fetching a workflow version that doesn't exist", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const fetched = await reader.getWorkflowVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(fetched).toBeUndefined();
  });

  it("refuses a second open draft for the same workflow", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    await createVersion({ workflowId: workflow.id, version: 1 });

    const createSecondDraft = createVersion({ workflowId: workflow.id, version: 2 });

    await expect(createSecondDraft).rejects.toThrow(UniqueConstraintViolationError);
  });

  it("rejects a duplicate version number for the same workflow", async () => {
    const { workflow, version } = await draftWithNode();

    await publishVersion({ workflowId: workflow.id, version: version.id });

    const createDuplicate = createVersion({ workflowId: workflow.id, version: 1 });

    await expect(createDuplicate).rejects.toThrow(UniqueConstraintViolationError);
  });

  it("allows a second draft only after the first is published", async () => {
    const { workflow, version } = await draftWithNode();

    await publishVersion({ workflowId: workflow.id, version: version.id });
    const second = await createVersion({ workflowId: workflow.id, version: 2 });

    expect(second.status).toBe("DRAFT");
  });

  it("publishes a draft that has nodes", async () => {
    const { workflow, version } = await draftWithNode();

    const published = await publishVersion({ workflowId: workflow.id, version: version.id });

    expect(published?.status).toBe("PUBLISHED");
    expect(published?.published_at).toBeInstanceOf(Date);
  });

  it("refuses to publish a draft with no nodes", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const created = await createVersion({ workflowId: workflow.id, version: 1 });

    const publishEmpty = publishVersion({ workflowId: workflow.id, version: created.id });

    await expect(publishEmpty).rejects.toThrow(VersionHasNoNodesError);
  });

  it("refuses to publish a version twice", async () => {
    const { workflow, version } = await draftWithNode();

    await publishVersion({ workflowId: workflow.id, version: version.id });

    const publishAgain = publishVersion({ workflowId: workflow.id, version: version.id });

    await expect(publishAgain).rejects.toThrow(VersionAlreadyPublishedError);
  });

  it("returns undefined when publishing a version that doesn't exist", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const published = await publishVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(published).toBeUndefined();
  });

  it("deletes a draft version and its nodes", async () => {
    const { workflow, version } = await draftWithNode();

    const deleted = await deleteVersion({ workflowId: workflow.id, version: version.id });
    const fetched = await reader.getWorkflowVersion({
      workflowId: workflow.id,
      version: version.id,
    });

    expect(deleted).toBe(true);
    expect(fetched).toBeUndefined();
  });

  it("refuses to delete a published version", async () => {
    const { workflow, version } = await draftWithNode();

    await publishVersion({ workflowId: workflow.id, version: version.id });

    const deletePublished = deleteVersion({ workflowId: workflow.id, version: version.id });

    await expect(deletePublished).rejects.toThrow(VersionNotDraftError);
  });

  it("reports false when deleting a version that doesn't exist", async () => {
    const workflow = await createWorkflow("Order Fulfillment");

    const deleted = await deleteVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(deleted).toBe(false);
  });
});
