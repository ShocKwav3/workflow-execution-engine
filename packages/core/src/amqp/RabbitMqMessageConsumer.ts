import type { Channel, ConsumeMessage } from "amqplib";
import { parseInternal } from "../errors/index.js";
import type { Logger } from "../logging/types.js";
import type { AmqpConnection } from "./AmqpConnection.js";
import {
  AmqpConsumerError,
  ConsumerAlreadySubscribedError,
  UnprocessableMessageError,
} from "./errors/index.js";
import { type MessageEnvelope, messageEnvelopeSchema } from "./messages/envelope.js";
import type { MessageConsumer, MessageHandler } from "./MessageConsumer.js";
import type { RecoveringChannel } from "./RecoveringChannel.js";
import { declareTopology } from "./topology.js";

export interface RabbitMqConsumerConfig {
  queue: string;
  prefetch: number;
}

type ConsumerState = "idle" | "running" | "stopping" | "stopped" | "failed";

export class RabbitMqMessageConsumer implements MessageConsumer {
  private readonly inFlight = new Set<Promise<void>>();
  private readonly done = Promise.withResolvers<void>();
  private state: ConsumerState = "idle";
  private recoveringChannel: RecoveringChannel<Channel> | undefined;
  private subscribedChannel: Channel | undefined;
  private consumerTag: string | undefined;

  constructor(
    private readonly connection: AmqpConnection,
    private readonly logger: Logger,
    private readonly config: RabbitMqConsumerConfig,
  ) {
    // Nobody may be watching yet, and an unwatched rejection must not kill the process by itself.
    this.done.promise.catch(() => {});
  }

  async consume(handler: MessageHandler): Promise<void> {
    if (this.state !== "idle") {
      throw new ConsumerAlreadySubscribedError(this.config.queue);
    }

    this.state = "running";

    const recoveringChannel = this.connection.createRecoveringChannel<Channel>({
      create: () => this.connection.createChannel(),
      configure: (channel) => this.subscribe(channel, handler),
      // A subscription that fails twice while the broker is reachable will not fix itself.
      maxAttempts: 2,
      initialRetryDelayMs: 1_000,
      maxRetryDelayMs: 30_000,
    });

    this.recoveringChannel = recoveringChannel;
    void recoveringChannel.failed().catch((error: unknown) => this.fail(error));

    try {
      await this.connection.start();
      await recoveringChannel.ready();
    } catch (error) {
      throw new AmqpConsumerError(error);
    }
  }

  finished(): Promise<void> {
    return this.done.promise;
  }

  async stop(): Promise<void> {
    if (this.state !== "idle" && this.state !== "running") {
      return;
    }

    this.state = "stopping";
    this.recoveringChannel?.disableRecovery();

    const channel = this.recoveringChannel?.current();

    try {
      if (channel && this.consumerTag) {
        await channel.cancel(this.consumerTag);
      }

      await Promise.allSettled([...this.inFlight]);
      // ack() is a bare socket write, so an awaited RPC is what proves the broker processed them.
      await channel?.checkQueue(this.config.queue);
    } catch (error) {
      this.logger.warn({ err: error }, "shutdown continued after an AMQP error");
    }

    // A handler failure during the drain has already moved the consumer to "failed".
    if (this.state === "stopping") {
      this.state = "stopped";
      this.done.resolve();
    }
  }

  private async subscribe(channel: Channel, handler: MessageHandler): Promise<void> {
    await declareTopology(channel);
    // Per-consumer: quorum queues raise a channel error on global QoS.
    await channel.prefetch(this.config.prefetch);

    // Recorded before consume(): a backlog can deliver in the same tick consume-ok arrives.
    this.subscribedChannel = channel;

    const { consumerTag } = await channel.consume(this.config.queue, (message) =>
      this.onMessage(channel, message, handler),
    );

    this.consumerTag = consumerTag;
    this.logger.info(
      { queue: this.config.queue, prefetch: this.config.prefetch },
      "subscribed — consuming",
    );
  }

  private onMessage(
    channel: Channel,
    message: ConsumeMessage | null,
    handler: MessageHandler,
  ): void {
    if (message === null) {
      // Broker-initiated cancel — deleted queue or failover. Closing lets the channel resubscribe.
      this.logger.warn("consumer cancelled by the broker — resubscribing");
      void channel.close().catch(() => {});

      return;
    }

    const delivery = this.deliver(channel, message, handler).catch((error: unknown) => {
      this.logger.warn({ err: error }, "delivery could not be settled");
    });

    this.inFlight.add(delivery);
    void delivery.finally(() => this.inFlight.delete(delivery));
  }

  private async deliver(
    channel: Channel,
    message: ConsumeMessage,
    handler: MessageHandler,
  ): Promise<void> {
    let envelope: MessageEnvelope;

    try {
      envelope = parseInternal(
        messageEnvelopeSchema,
        JSON.parse(message.content.toString()),
        "inboundMessageEnvelope",
      );
    } catch (error) {
      // With no dead-letter exchange yet, an unprocessable message is dropped here, visibly.
      this.logger.error({ err: error }, "unprocessable message dropped");
      channel.nack(message, false, false);

      return;
    }

    let dropped = false;

    try {
      await handler({ envelope, redelivered: message.fields.redelivered });
    } catch (error) {
      if (!(error instanceof UnprocessableMessageError)) {
        // Never ack: closing the channel requeues the delivery for whoever restarts this process.
        this.fail(error);
        await this.recoveringChannel?.close();

        return;
      }

      this.logger.error({ err: error }, "unprocessable message dropped");
      dropped = true;
    }

    // A replaced channel was closed, so the broker has already requeued this delivery.
    if (this.subscribedChannel !== channel) {
      return;
    }

    if (dropped) {
      channel.nack(message, false, false);
    } else {
      channel.ack(message);
    }
  }

  private fail(error: unknown): void {
    if (this.state === "stopped" || this.state === "failed") {
      return;
    }

    this.state = "failed";
    this.recoveringChannel?.disableRecovery();
    this.logger.error({ err: error }, "consumer stopped unrecoverably");
    this.done.reject(error);
  }
}
