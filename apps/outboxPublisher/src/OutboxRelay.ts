import type { MessagePublisher } from "@workflow-engine/core/amqp/MessagePublisher.js";
import { messageEnvelopeSchema } from "@workflow-engine/core/amqp/messages/envelope.js";
import type { OutboxClaimer } from "@workflow-engine/core/db/outbox/OutboxClaimer.js";
import { parseInternal } from "@workflow-engine/core/errors/index.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";

export interface OutboxRelayOptions {
  batchSize: number;
  staleClaimSeconds: number;
}

export class OutboxRelay {
  constructor(
    private readonly claimer: OutboxClaimer,
    private readonly publisher: MessagePublisher,
    private readonly logger: Logger,
    private readonly options: OutboxRelayOptions,
  ) {}

  async runBatch(): Promise<void> {
    // Claiming a row we cannot publish strands it until its claim goes stale, so check first.
    if (!this.publisher.isAvailable()) {
      return;
    }

    const claimed = await this.claimer.claimOutboxMessages({
      destination: "rabbitmq",
      staleClaimSeconds: this.options.staleClaimSeconds,
      batchSize: this.options.batchSize,
    });

    if (claimed.length === 0) {
      return;
    }

    this.logger.info({ count: claimed.length }, "claimed outbox messages");

    for (const row of claimed) {
      try {
        // Envelope only — a generic publisher cannot know every payload contract.
        const message = parseInternal(messageEnvelopeSchema, row.payload, "OutboxRelay.runBatch");

        await this.publisher.publish({
          messageId: row.id,
          routingKey: row.routing_key,
          body: message,
        });
        await this.claimer.markOutboxMessagePublished(row.id);

        this.logger.info({ outboxMessageId: row.id }, "published outbox message");
      } catch (error) {
        // Left PROCESSING on purpose — the stale-claim clause is what retries it.
        this.logger.error(
          { err: error, outboxMessageId: row.id },
          "failed to publish outbox message",
        );
      }
    }
  }
}
