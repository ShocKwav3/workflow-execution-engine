import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodeOrderingMismatchError, VersionNotDraftError } from "@/errors/domain/index.js";
import { createTransactionRunner } from "@/db/transaction.js";
import { PgNodeReader } from "@/db/node/PgNodeReader.js";
import { PgNodeWriter } from "@/db/node/PgNodeWriter.js";
import type { NodeUnitOfWork } from "@/db/node/NodeUnitOfWork.js";
import type { CreateNodeInput, ReorderNodesInput, UpdateNodeInput } from "@/db/node/node.schemas.js";
import type { NodeRow, WorkflowRow, WorkflowVersionRow } from "@/db/types.js";
import { type TestDatabase, startTestDatabase, stopTestDatabase } from "@core-test/testDatabase.js";
import { workflowUnitOfWorkFor, workflowVersionUnitOfWorkFor } from "@core-test/fixtures.js";

describe("node persistence", () => {
  let db: TestDatabase;
  let reader: PgNodeReader;
  let unitOfWork: NodeUnitOfWork;
  let workflow: WorkflowRow;
  let version: WorkflowVersionRow;

  const createNode = (input: CreateNodeInput): Promise<NodeRow | undefined> =>
    unitOfWork.run(({ nodes }) => nodes.createNode(input));

  const updateNode = (id: string, input: UpdateNodeInput): Promise<NodeRow | undefined> =>
    unitOfWork.run(({ nodes }) => nodes.updateNode(id, input));

  const deleteNode = (id: string): Promise<boolean> =>
    unitOfWork.run(({ nodes }) => nodes.deleteNode(id));

  const reorderNodes = (input: ReorderNodesInput): Promise<NodeRow[] | undefined> =>
    unitOfWork.run(({ nodes }) => nodes.reorderNodes(input));

  const listNodes = () =>
    reader.listNodesForVersion({ workflowId: workflow.id, version: version.id });

  beforeAll(async () => {
    db = await startTestDatabase();
    reader = new PgNodeReader(db.pool);
    unitOfWork = createTransactionRunner(db.pool, (client) => ({
      nodes: new PgNodeWriter(client),
    }));
  }, 60_000);

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE workflow CASCADE");
    workflow = await workflowUnitOfWorkFor(db.pool).run(({ workflows }) =>
      workflows.createWorkflow({ name: "Order Fulfillment" }),
    );
    version = await workflowVersionUnitOfWorkFor(db.pool).run(({ workflowVersions }) =>
      workflowVersions.createWorkflowVersion({ workflowId: workflow.id, version: 1 }),
    );
  });

  function addNode(name: string, type = "inventory") {
    return createNode({ workflowId: workflow.id, version: version.id, name, type });
  }

  it("assigns sequences in insertion order, starting at zero", async () => {
    await addNode("Reserve Inventory");
    await addNode("Charge Payment", "payment");
    await addNode("Ship Order", "shipping");

    const listed = await listNodes();

    expect(listed?.map((node) => [node.name, node.sequence])).toEqual([
      ["Reserve Inventory", 0],
      ["Charge Payment", 1],
      ["Ship Order", 2],
    ]);
  });

  it("fetches a node by its own id", async () => {
    const created = await addNode("Reserve Inventory");

    const fetched = await reader.getNodeById(created!.id);

    expect(fetched).toEqual(created);
  });

  it("rejects a malformed node id instead of leaking a raw DB error", async () => {
    await expect(reader.getNodeById("not-a-uuid")).rejects.toThrow(ZodError);
  });

  it("rejects creating a node with an empty name", async () => {
    const createEmpty = createNode({
      workflowId: workflow.id,
      version: version.id,
      name: "   ",
      type: "inventory",
    });

    await expect(createEmpty).rejects.toThrow(ZodError);
  });

  it("returns undefined when creating a node on a version that doesn't exist", async () => {
    const created = await createNode({
      workflowId: workflow.id,
      version: "00000000-0000-0000-0000-000000000000",
      name: "Reserve Inventory",
      type: "inventory",
    });

    expect(created).toBeUndefined();
  });

  it("updates a node's name without touching its type", async () => {
    const created = await addNode("Reserve Inventory");

    const updated = await updateNode(created!.id, { name: "Reserve Stock" });

    expect(updated?.name).toBe("Reserve Stock");
    expect(updated?.type).toBe("inventory");
  });

  it("rejects an update with no fields", async () => {
    const created = await addNode("Reserve Inventory");

    await expect(updateNode(created!.id, {})).rejects.toThrow(ZodError);
  });

  it("returns undefined when updating a node that doesn't exist", async () => {
    const updated = await updateNode("00000000-0000-0000-0000-000000000000", {
      name: "Anything",
    });

    expect(updated).toBeUndefined();
  });

  it("deletes a node", async () => {
    const created = await addNode("Reserve Inventory");

    const deleted = await deleteNode(created!.id);

    expect(deleted).toBe(true);
    expect(await reader.getNodeById(created!.id)).toBeUndefined();
  });

  it("reports false when deleting a node that doesn't exist", async () => {
    const deleted = await deleteNode("00000000-0000-0000-0000-000000000000");

    expect(deleted).toBe(false);
  });

  it("reorders the whole collection, rewriting sequences contiguously from zero", async () => {
    const first = await addNode("Reserve Inventory");
    const second = await addNode("Charge Payment", "payment");
    const third = await addNode("Ship Order", "shipping");

    const reordered = await reorderNodes({
      workflowId: workflow.id,
      version: version.id,
      nodeIds: [third!.id, first!.id, second!.id],
    });

    expect(reordered?.map((node) => [node.name, node.sequence])).toEqual([
      ["Ship Order", 0],
      ["Reserve Inventory", 1],
      ["Charge Payment", 2],
    ]);
  });

  it("swaps two adjacent nodes without tripping the sequence uniqueness constraint", async () => {
    const first = await addNode("Reserve Inventory");
    const second = await addNode("Charge Payment", "payment");

    const reordered = await reorderNodes({
      workflowId: workflow.id,
      version: version.id,
      nodeIds: [second!.id, first!.id],
    });

    expect(reordered?.map((node) => node.name)).toEqual(["Charge Payment", "Reserve Inventory"]);
  });

  it("refuses a reorder that omits a node", async () => {
    const first = await addNode("Reserve Inventory");

    await addNode("Charge Payment", "payment");

    const reorder = reorderNodes({
      workflowId: workflow.id,
      version: version.id,
      nodeIds: [first!.id],
    });

    await expect(reorder).rejects.toThrow(NodeOrderingMismatchError);
  });

  it("refuses a reorder that repeats a node", async () => {
    const first = await addNode("Reserve Inventory");

    await addNode("Charge Payment", "payment");

    const reorder = reorderNodes({
      workflowId: workflow.id,
      version: version.id,
      nodeIds: [first!.id, first!.id],
    });

    await expect(reorder).rejects.toThrow(NodeOrderingMismatchError);
  });

  it("leaves sequences untouched when a reorder is refused", async () => {
    const first = await addNode("Reserve Inventory");

    await addNode("Charge Payment", "payment");

    await expect(
      reorderNodes({ workflowId: workflow.id, version: version.id, nodeIds: [first!.id] }),
    ).rejects.toThrow(NodeOrderingMismatchError);

    const listed = await listNodes();

    expect(listed?.map((node) => node.sequence)).toEqual([0, 1]);
  });

  describe("once the version is published", () => {
    beforeEach(async () => {
      await addNode("Reserve Inventory");
      await workflowVersionUnitOfWorkFor(db.pool).run(({ workflowVersions }) =>
        workflowVersions.publishWorkflowVersion({ workflowId: workflow.id, version: version.id }),
      );
    });

    it("refuses to create a node", async () => {
      await expect(addNode("Charge Payment", "payment")).rejects.toThrow(VersionNotDraftError);
    });

    it("refuses to update a node", async () => {
      const listed = await listNodes();

      await expect(updateNode(listed![0]!.id, { name: "Renamed" })).rejects.toThrow(
        VersionNotDraftError,
      );
    });

    it("refuses to delete a node", async () => {
      const listed = await listNodes();

      await expect(deleteNode(listed![0]!.id)).rejects.toThrow(VersionNotDraftError);
    });

    it("refuses to reorder nodes", async () => {
      const listed = await listNodes();

      await expect(
        reorderNodes({
          workflowId: workflow.id,
          version: version.id,
          nodeIds: [listed![0]!.id],
        }),
      ).rejects.toThrow(VersionNotDraftError);
    });
  });

  // Fails if createNode reads status outside the write's transaction: an unlocked read sees the
  // pre-publish snapshot and inserts into a version that is already frozen by commit time.
  it("never admits a node into a version a concurrent transaction is publishing", async () => {
    await addNode("Reserve Inventory");

    const publisher = await db.pool.connect();

    try {
      await publisher.query("BEGIN");
      await publisher.query(
        `SELECT * FROM workflow_version WHERE workflow_id = $1 AND version = 1 FOR UPDATE`,
        [workflow.id],
      );
      await publisher.query(
        `UPDATE workflow_version SET status = 'PUBLISHED', published_at = now()
         WHERE workflow_id = $1 AND version = 1`,
        [workflow.id],
      );

      const create = createNode({
        workflowId: workflow.id,
        version: version.id,
        name: "Charge Payment",
        type: "payment",
      });

      await publisher.query("COMMIT");

      await expect(create).rejects.toThrow(VersionNotDraftError);
    } finally {
      publisher.release();
    }

    const listed = await listNodes();

    expect(listed).toHaveLength(1);
  });
});
