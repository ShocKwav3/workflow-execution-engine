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
  private connectionUp = false;
  private disposed = false;

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

  async dispose(): Promise<void> {
    this.disposed = true;
    this.channel = undefined;
    await this.connection?.close();
  }

  private async connect(config: AmqpConnectionConfig): Promise<void> {
    const connection = await amqplib.connect(config.url, {
      recovery: {
        setup: async (recovered: ChannelModel) => {
          await this.openChannel(recovered);
        },
      },
    });

    connection.on("connect", () => {
      this.connectionUp = true;
      this.logger.info("AMQP connection established");
    });

    connection.on("disconnect", (err) => {
      this.connectionUp = false;
      this.channel = undefined;
      this.logger.warn({ err }, "AMQP connection lost — recovery will retry");
    });

    connection.on("reconnect-scheduled", ({ attempt, delay }) => {
      this.logger.warn({ attempt, delay }, "AMQP reconnect scheduled");
    });

    connection.on("error", (err) => {
      this.logger.error({ err }, "unexpected error on AMQP connection");
    });

    // connect() only resolves once connected, so disposal before that lands here instead.
    if (this.disposed) {
      await connection.close();

      return;
    }

    this.connection = connection;
    this.connectionUp = true;
  }

  private async openChannel(model: ChannelModel | RecoveringChannelModel): Promise<void> {
    const channel = await model.createConfirmChannel();

    channel.on("error", (err) => {
      this.logger.error({ err }, "unexpected error on AMQP channel");
    });

    // Recovery watches the connection, not the channel, so a channel-only close is ours to handle.
    channel.on("close", () => {
      if (this.channel !== channel) {
        return;
      }

      this.channel = undefined;
      this.logger.warn("AMQP channel closed — opening a replacement");
      setImmediate(() => void this.replaceChannel());
    });

    await declareTopology(channel);

    if (this.disposed) {
      await channel.close();

      return;
    }

    this.channel = channel;
  }

  private async replaceChannel(): Promise<void> {
    // A connection-level loss closes the channel too, and there recovery's setup reopens it for us.
    if (this.disposed || !this.connectionUp || !this.connection || this.channel) {
      return;
    }

    try {
      await this.openChannel(this.connection);
    } catch (error) {
      this.logger.error({ err: error }, "AMQP channel could not be reopened");
    }
  }
}
