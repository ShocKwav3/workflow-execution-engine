import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ConfirmChannel } from "amqplib";
import type { MessagePublisher } from "@workflow-engine/core/amqp/MessagePublisher.js";
import { createStartWorkflowExecutionMessage } from "@workflow-engine/core/amqp/messages/startWorkflowExecution.js";
import {
  amqpConnectionConfigToken,
  messagePublisherToken,
} from "@workflow-engine/core/amqp/tokens.js";
import { RabbitMqMessagePublisher } from "@workflow-engine/core/amqp/RabbitMqMessagePublisher.js";
import { AMQP_TOPOLOGY } from "@workflow-engine/core/amqp/topology.js";
import type { Container } from "@workflow-engine/core/di/container.js";
import { PG_POOL_DEFAULTS } from "@workflow-engine/core/db/config.js";
import {
  OUTBOX_MESSAGE_STATUS,
  type OutboxMessageRow,
} from "@workflow-engine/core/db/outbox/outbox.types.js";
import { outboxClaimerToken, pgPoolConfigToken } from "@workflow-engine/core/db/tokens.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import {
  type TestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "@workflow-engine/core/test/testDatabase.js";
import {
  type TestRabbitmq,
  startTestRabbitmq,
  stopTestRabbitmq,
} from "@workflow-engine/core/test/testRabbitmq.js";
import { OutboxRelay } from "@/OutboxRelay.js";
import { buildContainer } from "@/registrations.js";

const silentLogger: Logger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

describe("outbox publisher end to end", () => {
  let db: TestDatabase;
  let rabbitmq: TestRabbitmq;
  let inspector: ConfirmChannel;
  let container: Container;

  // The publisher connects in the background, so a test driving a real broker has to wait for it.
  const connectedPublisher = async (): Promise<MessagePublisher> => {
    const publisher = container.resolve(messagePublisherToken);

    if (publisher instanceof RabbitMqMessagePublisher) {
      await publisher.ready();
    }

    return publisher;
  };

  const relayWith = (publisher: MessagePublisher) =>
    new OutboxRelay(container.resolve(outboxClaimerToken), publisher, silentLogger, {
      batchSize: 10,
      staleClaimSeconds: 30,
    });

  const insertPendingMessage = async (workflowExecutionId = randomUUID()) => {
    const result = await db.pool.query<OutboxMessageRow>(
      `INSERT INTO outbox_message (destination, routing_key, payload)
       VALUES ('rabbitmq', $1, $2) RETURNING *`,
      [AMQP_TOPOLOGY.routingKey, createStartWorkflowExecutionMessage(workflowExecutionId)],
    );

    return result.rows[0]!;
  };

  const readMessage = async (id: string) => {
    const result = await db.pool.query<OutboxMessageRow>(
      "SELECT * FROM outbox_message WHERE id = $1",
      [id],
    );

    return result.rows[0]!;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    rabbitmq = await startTestRabbitmq();
    inspector = await rabbitmq.connectionModel.createConfirmChannel();
  }, 120_000);

  afterAll(async () => {
    await stopTestRabbitmq(rabbitmq);
    await stopTestDatabase(db);
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE outbox_message");
    await inspector.purgeQueue(AMQP_TOPOLOGY.queue);

    container = buildContainer(silentLogger);

    // The point of config tokens: a test overrides the registration instead of process.env.
    container.register(
      pgPoolConfigToken,
      () => ({ ...PG_POOL_DEFAULTS, ...db.connection, max: 2 }),
      { lifetime: "singleton" },
    );
    container.register(amqpConnectionConfigToken, () => ({ url: rabbitmq.url }), {
      lifetime: "singleton",
    });
  });

  afterEach(async () => {
    await container.dispose();
  });

  it("moves a pending row to PUBLISHED and puts the command on the queue", async () => {
    const workflowExecutionId = randomUUID();
    const row = await insertPendingMessage(workflowExecutionId);

    await relayWith(await connectedPublisher()).runBatch();

    const stored = await readMessage(row.id);

    expect(stored.status).toBe(OUTBOX_MESSAGE_STATUS.PUBLISHED);
    expect(stored.published_at).toBeInstanceOf(Date);

    const delivered = await inspector.get(AMQP_TOPOLOGY.queue, { noAck: true });

    expect(delivered).not.toBe(false);

    if (delivered === false) {
      return;
    }

    expect(delivered.properties.messageId).toBe(row.id);
    expect(JSON.parse(delivered.content.toString())).toMatchObject({
      type: "StartWorkflowExecution",
      payload: { workflowExecutionId },
    });
  });

  it("leaves a row claimed but unpublished when the broker rejects the publish", async () => {
    const row = await insertPendingMessage();
    const failingPublisher: MessagePublisher = {
      publish: () => Promise.reject(new Error("broker unreachable")),
      isAvailable: () => true,
    };

    await expect(relayWith(failingPublisher).runBatch()).resolves.toBeUndefined();

    const stored = await readMessage(row.id);

    expect(stored.status).toBe(OUTBOX_MESSAGE_STATUS.PROCESSING);
    expect(stored.claimed_at).toBeInstanceOf(Date);
    expect(stored.published_at).toBeNull();

    await expect(inspector.get(AMQP_TOPOLOGY.queue, { noAck: true })).resolves.toBe(false);
  });

  it("republishes a row whose previous claim went stale, producing a duplicate", async () => {
    const row = await insertPendingMessage();

    await db.pool.query(
      `UPDATE outbox_message SET status = $1, claimed_at = now() - interval '5 minutes'
       WHERE id = $2`,
      [OUTBOX_MESSAGE_STATUS.PROCESSING, row.id],
    );

    await relayWith(await connectedPublisher()).runBatch();

    expect((await readMessage(row.id)).status).toBe(OUTBOX_MESSAGE_STATUS.PUBLISHED);
    await expect(inspector.get(AMQP_TOPOLOGY.queue, { noAck: true })).resolves.not.toBe(false);
  });
});
