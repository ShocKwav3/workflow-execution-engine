import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UniqueConstraintViolationError } from "../errors/index.js";
import {
  VersionAlreadyPublishedError,
  VersionHasNoNodesError,
  VersionNotDraftError,
} from "../../errors/domain/index.js";
import { NodeRepository } from "../nodeRepository.js";
import { WorkflowRepository } from "../workflowRepository.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../../../test/testDatabase.js";

describe("WorkflowRepository", () => {
  let db: TestDatabase;
  let repo: WorkflowRepository;
  let nodes: NodeRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repo = new WorkflowRepository(db.pool);
    nodes = new NodeRepository(db.pool);
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
  });

  async function draftWithNode(name = "Order Fulfillment") {
    const workflow = await repo.createWorkflow({ name });
    const version = await repo.createWorkflowVersion({ workflowId: workflow.id, version: 1 });

    await nodes.createNode({
      workflowId: workflow.id,
      version: version.id,
      name: "Reserve Inventory",
      type: "inventory",
    });

    return { workflow, version };
  }

  it("creates and fetches a workflow", async () => {
    const created = await repo.createWorkflow({ name: "Order Fulfillment" });

    const fetched = await repo.getWorkflowById(created.id);

    expect(fetched).toEqual(created);
    expect(created.name).toBe("Order Fulfillment");
  });

  it("rejects creating a workflow with an empty name", async () => {
    const createEmpty = repo.createWorkflow({ name: "  " });

    await expect(createEmpty).rejects.toThrow(ZodError);
  });

  it("returns undefined when fetching a workflow that doesn't exist", async () => {
    const fetched = await repo.getWorkflowById("00000000-0000-0000-0000-000000000000");

    expect(fetched).toBeUndefined();
  });

  it("rejects fetching a workflow with a malformed id instead of leaking a raw DB error", async () => {
    const getMalformed = repo.getWorkflowById("not-a-uuid");

    await expect(getMalformed).rejects.toThrow(ZodError);
  });

  it("lists all created workflows", async () => {
    await repo.createWorkflow({ name: "Workflow A" });
    await repo.createWorkflow({ name: "Workflow B" });

    const workflows = await repo.listWorkflows();

    expect(workflows).toHaveLength(2);
    expect(workflows.map((w) => w.name)).toEqual(["Workflow A", "Workflow B"]);
  });

  it("creates a workflow version as an empty draft", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const created = await repo.createWorkflowVersion({ workflowId: workflow.id, version: 1 });
    const fetched = await repo.getWorkflowVersion({ workflowId: workflow.id, version: created.id });

    expect(created.status).toBe("DRAFT");
    expect(created.published_at).toBeNull();
    expect(fetched).toEqual(created);
  });

  it("rejects creating a workflow version with an invalid workflowId", async () => {
    const createInvalid = repo.createWorkflowVersion({ workflowId: "not-a-uuid", version: 1 });

    await expect(createInvalid).rejects.toThrow(ZodError);
  });

  it("rejects creating a workflow version with a non-positive version number", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const createInvalid = repo.createWorkflowVersion({ workflowId: workflow.id, version: 0 });

    await expect(createInvalid).rejects.toThrow(ZodError);
  });

  it("returns undefined when fetching a workflow version that doesn't exist", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const fetched = await repo.getWorkflowVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(fetched).toBeUndefined();
  });

  it("refuses a second open draft for the same workflow", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    await repo.createWorkflowVersion({ workflowId: workflow.id, version: 1 });

    const createSecondDraft = repo.createWorkflowVersion({ workflowId: workflow.id, version: 2 });

    await expect(createSecondDraft).rejects.toThrow(UniqueConstraintViolationError);
  });

  it("rejects a duplicate version number for the same workflow", async () => {
    const { workflow, version } = await draftWithNode();

    await repo.publishWorkflowVersion({ workflowId: workflow.id, version: version.id });

    const createDuplicate = repo.createWorkflowVersion({ workflowId: workflow.id, version: 1 });

    await expect(createDuplicate).rejects.toThrow(UniqueConstraintViolationError);
  });

  it("allows a second draft only after the first is published", async () => {
    const { workflow, version } = await draftWithNode();

    await repo.publishWorkflowVersion({ workflowId: workflow.id, version: version.id });
    const second = await repo.createWorkflowVersion({ workflowId: workflow.id, version: 2 });

    expect(second.status).toBe("DRAFT");
  });

  it("publishes a draft that has nodes", async () => {
    const { workflow, version } = await draftWithNode();

    const published = await repo.publishWorkflowVersion({
      workflowId: workflow.id,
      version: version.id,
    });

    expect(published?.status).toBe("PUBLISHED");
    expect(published?.published_at).toBeInstanceOf(Date);
  });

  it("refuses to publish a draft with no nodes", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const created = await repo.createWorkflowVersion({ workflowId: workflow.id, version: 1 });

    const publishEmpty = repo.publishWorkflowVersion({
      workflowId: workflow.id,
      version: created.id,
    });

    await expect(publishEmpty).rejects.toThrow(VersionHasNoNodesError);
  });

  it("refuses to publish a version twice", async () => {
    const { workflow, version } = await draftWithNode();

    await repo.publishWorkflowVersion({ workflowId: workflow.id, version: version.id });

    const publishAgain = repo.publishWorkflowVersion({
      workflowId: workflow.id,
      version: version.id,
    });

    await expect(publishAgain).rejects.toThrow(VersionAlreadyPublishedError);
  });

  it("returns undefined when publishing a version that doesn't exist", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const published = await repo.publishWorkflowVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(published).toBeUndefined();
  });

  it("deletes a draft version and its nodes", async () => {
    const { workflow, version } = await draftWithNode();

    const deleted = await repo.deleteWorkflowVersion({
      workflowId: workflow.id,
      version: version.id,
    });
    const fetched = await repo.getWorkflowVersion({ workflowId: workflow.id, version: version.id });

    expect(deleted).toBe(true);
    expect(fetched).toBeUndefined();
  });

  it("refuses to delete a published version", async () => {
    const { workflow, version } = await draftWithNode();

    await repo.publishWorkflowVersion({ workflowId: workflow.id, version: version.id });

    const deletePublished = repo.deleteWorkflowVersion({
      workflowId: workflow.id,
      version: version.id,
    });

    await expect(deletePublished).rejects.toThrow(VersionNotDraftError);
  });

  it("reports false when deleting a version that doesn't exist", async () => {
    const workflow = await repo.createWorkflow({ name: "Order Fulfillment" });

    const deleted = await repo.deleteWorkflowVersion({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
    });

    expect(deleted).toBe(false);
  });
});
