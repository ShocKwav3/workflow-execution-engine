import amqplib, {
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from "amqplib";
import type { Disposable } from "../di/types.js";
import type { Logger } from "../logging/types.js";
import type { AmqpConnectionConfig } from "./config.js";
import { AmqpConnectionError, AmqpPublishError } from "./errors/index.js";
import type { MessagePublisher, OutboundMessage } from "./MessagePublisher.js";
import { AMQP_TOPOLOGY, declareTopology } from "./topology.js";

export class RabbitMqMessagePublisher implements MessagePublisher, Disposable {
  private readonly established: Promise<void>;
  private connection: RecoveringChannelModel | undefined;
  private channel: ConfirmChannel | undefined;

  constructor(
    config: AmqpConnectionConfig,
    private readonly logger: Logger,
  ) {
    this.established = this.connect(config);

    void this.established.catch((error: unknown) => {
      logger.error({ err: error }, "AMQP connection could not be established");
    });
  }

  // Resolves on first connect — callers that must not block on a down broker simply ignore it.
  ready(): Promise<void> {
    return this.established;
  }

  isAvailable(): boolean {
    return this.channel !== undefined;
  }

  async publish({ messageId, routingKey, body }: OutboundMessage): Promise<void> {
    const channel = this.channel;

    if (!channel) {
      throw new AmqpConnectionError(new Error("no AMQP channel available"));
    }

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        AMQP_TOPOLOGY.exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        { persistent: true, messageId, contentType: "application/json" },
        (err) => (err ? reject(new AmqpPublishError(err)) : resolve()),
      );
    });
  }

  async dispose(): Promise<void> {
    await this.connection?.close();
  }

  private async connect(config: AmqpConnectionConfig): Promise<void> {
    const connection = await amqplib.connect(config.url, {
      recovery: {
        setup: async (recovered: ChannelModel) => {
          const channel = await recovered.createConfirmChannel();

          channel.on("error", (err) => {
            this.logger.error({ err }, "unexpected error on AMQP channel");
          });

          await declareTopology(channel);
          this.channel = channel;
        },
      },
    });

    connection.on("connect", () => {
      this.logger.info("AMQP connection established");
    });

    connection.on("disconnect", (err) => {
      this.channel = undefined;
      this.logger.warn({ err }, "AMQP connection lost — recovery will retry");
    });

    connection.on("reconnect-scheduled", ({ attempt, delay }) => {
      this.logger.warn({ attempt, delay }, "AMQP reconnect scheduled");
    });

    connection.on("error", (err) => {
      this.logger.error({ err }, "unexpected error on AMQP connection");
    });

    this.connection = connection;
  }
}
