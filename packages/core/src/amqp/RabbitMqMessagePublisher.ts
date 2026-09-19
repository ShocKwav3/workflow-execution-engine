import type { ConfirmChannel } from "amqplib";
import type { Logger } from "../logging/types.js";
import type { AmqpConnection } from "./AmqpConnection.js";
import { AmqpConnectionError, AmqpPublishError } from "./errors/index.js";
import type { MessagePublisher, OutboundMessage } from "./MessagePublisher.js";
import type { RecoveringChannel } from "./RecoveringChannel.js";
import { AMQP_TOPOLOGY, declareTopology } from "./topology.js";

export class RabbitMqMessagePublisher implements MessagePublisher {
  private readonly started: Promise<void>;
  private readonly channel: RecoveringChannel<ConfirmChannel>;

  constructor(
    private readonly connection: AmqpConnection,
    logger: Logger,
  ) {
    this.channel = connection.createRecoveringChannel<ConfirmChannel>({
      create: () => connection.createConfirmChannel(),
      configure: async (channel) => {
        await declareTopology(channel);
        logger.info("publishing channel ready");
      },
      // A publisher has nothing better to do than keep trying; the relay skips cycles meanwhile.
      maxAttempts: Infinity,
      initialRetryDelayMs: 1_000,
      maxRetryDelayMs: 30_000,
    });

    this.started = connection.start();

    void this.started.catch((error: unknown) => {
      logger.error({ err: error }, "AMQP connection could not be established");
    });
  }

  // Resolves once a configured channel exists; callers that must not block on a down broker ignore it.
  async ready(): Promise<void> {
    await Promise.all([this.started, this.channel.ready()]);
  }

  isAvailable(): boolean {
    return this.channel.current() !== undefined && this.connection.isUp();
  }

  async publish({ messageId, routingKey, body }: OutboundMessage): Promise<void> {
    const channel = this.channel.current();

    if (!channel || !this.connection.isUp()) {
      throw new AmqpConnectionError(new Error("no AMQP channel available"));
    }

    await new Promise<void>((resolve, reject) => {
      try {
        channel.publish(
          AMQP_TOPOLOGY.exchange,
          routingKey,
          Buffer.from(JSON.stringify(body)),
          { persistent: true, messageId, contentType: "application/json" },
          (err) => (err ? reject(new AmqpPublishError(err)) : resolve()),
        );
      } catch (error) {
        // publish() throws synchronously on an already-closed channel; callers get one error type.
        reject(new AmqpPublishError(error));
      }
    });
  }
}
