import { messagePublisherToken } from "@workflow-engine/core/amqp/tokens.js";
import type { Container } from "@workflow-engine/core/di/container.js";
import { outboxClaimerToken } from "@workflow-engine/core/db/tokens.js";
import { createContextLogger } from "@workflow-engine/core/logging/contextLogger.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import type { OutboxPublisherConfig } from "./config.js";
import { OutboxRelay } from "./OutboxRelay.js";
import { createPoller, type Poller } from "./poller.js";
import { buildContainer } from "./registrations.js";

export class PublisherRuntime {
  private readonly container: Container;
  private readonly poller: Poller;

  constructor(config: OutboxPublisherConfig, logger: Logger) {
    this.container = buildContainer(logger);

    const relay = new OutboxRelay(
      this.container.resolve(outboxClaimerToken),
      this.container.resolve(messagePublisherToken),
      createContextLogger(logger, "Relay"),
      { batchSize: config.batchSize, staleClaimSeconds: config.staleClaimSeconds },
    );

    this.poller = createPoller({
      intervalMs: config.pollIntervalMs,
      logger: createContextLogger(logger, "Poller"),
      tick: () => relay.runBatch(),
    });
  }

  start(): void {
    this.poller.start();
  }

  async close(): Promise<void> {
    await this.poller.stop();
    await this.container.dispose();
  }
}
