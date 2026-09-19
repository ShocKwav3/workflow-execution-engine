import amqplib, {
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from "amqplib";
import type { Disposable } from "../di/types.js";
import type { Logger } from "../logging/types.js";
import type { AmqpConnectionConfig } from "./config.js";
import { AmqpConnectionError } from "./errors/index.js";
import { RecoveringChannel, type RecoveringChannelOptions } from "./RecoveringChannel.js";

// amqplib's default starts at 100ms, which spends five attempts in the first three seconds.
const RECOVERY_BACKOFF = { initialDelay: 1_000, maxDelay: 30_000 } as const;
const WAITING_LOG_INTERVAL_MS = 10_000;

export class AmqpConnection implements Disposable {
  private readonly channels = new Set<RecoveringChannel<Channel>>();
  private recovering: RecoveringChannelModel | undefined;
  private model: ChannelModel | undefined;
  private starting: Promise<void> | undefined;
  private disposing: Promise<void> | undefined;
  private waitingTimer: NodeJS.Timeout | undefined;
  private up = false;
  private disposed = false;

  constructor(
    private readonly config: AmqpConnectionConfig,
    private readonly logger: Logger,
  ) {}

  // Every caller gets the same connection.
  start(): Promise<void> {
    this.starting ??= this.connect();

    return this.starting;
  }

  isUp(): boolean {
    return this.up && !this.disposed;
  }

  createRecoveringChannel<C extends Channel>(
    options: RecoveringChannelOptions<C>,
  ): RecoveringChannel<C> {
    const channel = new RecoveringChannel(this, this.logger, options);

    this.channels.add(channel);

    if (this.isUp()) {
      void channel.open();
    }

    return channel;
  }

  async createChannel(): Promise<Channel> {
    return await this.activeModel().createChannel();
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    return await this.activeModel().createConfirmChannel();
  }

  dispose(): Promise<void> {
    this.disposing ??= this.close();

    return this.disposing;
  }

  private async connect(): Promise<void> {
    if (this.disposed) {
      throw new AmqpConnectionError(new Error("AMQP connection already disposed"));
    }

    this.logger.info("connecting to AMQP broker");

    // The promise API exposes no events until the first connect, so failed attempts are silent.
    this.waitingTimer = setInterval(
      () => this.logger.warn("still waiting for the AMQP broker — retrying in the background"),
      WAITING_LOG_INTERVAL_MS,
    );

    let recovering: RecoveringChannelModel;

    try {
      recovering = await amqplib.connect(this.config.url, {
        recovery: {
          ...RECOVERY_BACKOFF,
          setup: async (recovered: ChannelModel) => {
            // Disposal can land mid-connect; the disposed check below closes this connection.
            if (this.disposed) {
              return;
            }

            this.model = recovered;
            this.up = true;
            // Logged here, not on 'connect': the first 'connect' fires before listeners can attach.
            this.logger.info("AMQP connection established");

            // Not awaited: a channel's setup failure is the channel's to retry, not a reason to reconnect.
            for (const channel of this.channels) {
              void channel.open();
            }
          },
        },
      });
    } finally {
      clearInterval(this.waitingTimer);
    }

    recovering.on("disconnect", (err) => {
      this.up = false;
      this.model = undefined;
      this.logger.warn({ err }, "AMQP connection lost — recovery will retry");
    });

    recovering.on("reconnect-scheduled", ({ attempt, delay }) => {
      this.logger.warn({ attempt, delay }, "AMQP reconnect scheduled");
    });

    recovering.on("error", (err) => {
      this.logger.error({ err }, "unexpected error on AMQP connection");
    });

    // connect() resolves only once connected, so disposal during it lands here instead.
    if (this.disposed) {
      await recovering.close();

      return;
    }

    this.recovering = recovering;
  }

  private async close(): Promise<void> {
    this.disposed = true;
    this.up = false;
    this.model = undefined;
    clearInterval(this.waitingTimer);

    for (const channel of this.channels) {
      channel.disableRecovery();
    }

    await this.recovering?.close();
  }

  private activeModel(): ChannelModel {
    if (!this.model || !this.isUp()) {
      throw new AmqpConnectionError(new Error("no AMQP connection available"));
    }

    return this.model;
  }
}
