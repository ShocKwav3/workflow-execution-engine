import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { MessagePublisher } from "@workflow-engine/core/amqp/MessagePublisher.js";
import { createStartWorkflowExecutionMessage } from "@workflow-engine/core/amqp/messages/startWorkflowExecution.js";
import { AMQP_TOPOLOGY } from "@workflow-engine/core/amqp/topology.js";
import type { OutboxClaimer } from "@workflow-engine/core/db/outbox/OutboxClaimer.js";
import {
  OUTBOX_MESSAGE_STATUS,
  type OutboxMessageRow,
} from "@workflow-engine/core/db/outbox/outbox.types.js";
import { InternalValidationError } from "@workflow-engine/core/errors/index.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { OutboxRelay } from "@/OutboxRelay.js";

const testLogger = (): Logger => {
  const logger: Logger = {
    child: () => logger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };

  return logger;
};

const outboxRow = (payload: unknown = createStartWorkflowExecutionMessage(randomUUID())) =>
  ({
    id: randomUUID(),
    destination: "rabbitmq",
    routing_key: AMQP_TOPOLOGY.routingKey,
    payload,
    status: OUTBOX_MESSAGE_STATUS.PROCESSING,
    claimed_at: new Date(),
    published_at: null,
    created_at: new Date(),
  }) satisfies OutboxMessageRow;

const claimerFor = (rows: OutboxMessageRow[]): OutboxClaimer => ({
  claimOutboxMessages: vi.fn().mockResolvedValue(rows),
  markOutboxMessagePublished: vi.fn().mockResolvedValue(undefined),
});

const publisherThat = (behaviour: MessagePublisher["publish"]): MessagePublisher => ({
  publish: vi.fn(behaviour),
  isAvailable: () => true,
});

const unavailablePublisher = (): MessagePublisher => ({
  publish: vi.fn(() => Promise.reject(new Error("should never be called"))),
  isAvailable: () => false,
});

const acceptingPublisher = () => publisherThat(() => Promise.resolve());

const rejectingPublisher = () =>
  publisherThat(() => Promise.reject(new Error("broker unreachable")));

const relayFor = (claimer: OutboxClaimer, publisher: MessagePublisher, logger = testLogger()) =>
  new OutboxRelay(claimer, publisher, logger, { batchSize: 10, staleClaimSeconds: 30 });

describe("OutboxRelay", () => {
  it("publishes each claimed row under its own routing key and id", async () => {
    const row = outboxRow();
    const publisher = acceptingPublisher();

    await relayFor(claimerFor([row]), publisher).runBatch();

    expect(publisher.publish).toHaveBeenCalledExactlyOnceWith({
      messageId: row.id,
      routingKey: row.routing_key,
      body: row.payload,
    });
  });

  it("marks a row published only after the publish resolves", async () => {
    const row = outboxRow();
    const claimer = claimerFor([row]);
    const order: string[] = [];

    const publisher = publisherThat(async () => {
      order.push("publish");
    });

    vi.mocked(claimer.markOutboxMessagePublished).mockImplementation(async () => {
      order.push("mark");
    });

    await relayFor(claimer, publisher).runBatch();

    expect(order).toEqual(["publish", "mark"]);
  });

  it("leaves the row unmarked when publishing fails", async () => {
    const claimer = claimerFor([outboxRow()]);

    await relayFor(claimer, rejectingPublisher()).runBatch();

    expect(claimer.markOutboxMessagePublished).not.toHaveBeenCalled();
  });

  it("keeps going after a failed row instead of abandoning the batch", async () => {
    const failing = outboxRow();
    const healthy = outboxRow();
    const claimer = claimerFor([failing, healthy]);
    const publisher = publisherThat((message) =>
      message.messageId === failing.id
        ? Promise.reject(new Error("broker unreachable"))
        : Promise.resolve(),
    );

    await relayFor(claimer, publisher).runBatch();

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(claimer.markOutboxMessagePublished).toHaveBeenCalledExactlyOnceWith(healthy.id);
  });

  it("never publishes a row whose envelope is malformed", async () => {
    const claimer = claimerFor([outboxRow({ nonsense: true })]);
    const publisher = acceptingPublisher();

    await relayFor(claimer, publisher).runBatch();

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(claimer.markOutboxMessagePublished).not.toHaveBeenCalled();
  });

  it("reports a malformed envelope as our own bug, not a client error", async () => {
    const logger = testLogger();
    const claimer = claimerFor([outboxRow({ nonsense: true })]);

    await relayFor(claimer, acceptingPublisher(), logger).runBatch();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(InternalValidationError) }),
      "failed to publish outbox message",
    );
  });

  it("does nothing when there is nothing to claim", async () => {
    const claimer = claimerFor([]);
    const publisher = acceptingPublisher();

    await relayFor(claimer, publisher).runBatch();

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(claimer.markOutboxMessagePublished).not.toHaveBeenCalled();
  });

  it("claims only rabbitmq rows, with the configured batch size and stale threshold", async () => {
    const claimer = claimerFor([]);

    await relayFor(claimer, acceptingPublisher()).runBatch();

    expect(claimer.claimOutboxMessages).toHaveBeenCalledExactlyOnceWith({
      destination: "rabbitmq",
      batchSize: 10,
      staleClaimSeconds: 30,
    });
  });

  it("claims nothing while the publisher has no connection", async () => {
    const claimer = claimerFor([outboxRow()]);
    const publisher = unavailablePublisher();

    await relayFor(claimer, publisher).runBatch();

    expect(claimer.claimOutboxMessages).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("publishes any well-formed message, not only the commands it knows about", async () => {
    const row = outboxRow({
      messageId: randomUUID(),
      correlationId: randomUUID(),
      type: "SomeFutureEvent",
      occurredAt: new Date().toISOString(),
      payload: { anything: "goes" },
    });
    const claimer = claimerFor([row]);
    const publisher = acceptingPublisher();

    await relayFor(claimer, publisher).runBatch();

    expect(publisher.publish).toHaveBeenCalledExactlyOnceWith({
      messageId: row.id,
      routingKey: row.routing_key,
      body: row.payload,
    });
    expect(claimer.markOutboxMessagePublished).toHaveBeenCalledExactlyOnceWith(row.id);
  });
});
