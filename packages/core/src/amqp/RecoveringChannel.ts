import type { Channel } from "amqplib";
import type { Logger } from "../logging/types.js";
import type { AmqpConnection } from "./AmqpConnection.js";

export interface RecoveringChannelOptions<C extends Channel> {
  create(): Promise<C>;
  configure(channel: C): Promise<void>;
  maxAttempts: number;
  /** First retry delay; doubles per consecutive failure up to maxRetryDelayMs. */
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
}

// One logical channel that outlives its physical channels. Created by AmqpConnection.
export class RecoveringChannel<C extends Channel> {
  private readonly firstReady = Promise.withResolvers<void>();
  private readonly exhausted = Promise.withResolvers<void>();
  private channel: C | undefined;
  private opening: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private retryTimer: NodeJS.Timeout | undefined;
  private failures = 0;
  private recovering = true;

  constructor(
    private readonly connection: AmqpConnection,
    private readonly logger: Logger,
    private readonly options: RecoveringChannelOptions<C>,
  ) {
    // Nobody may be watching yet, and an unwatched rejection must not kill the process by itself.
    this.firstReady.promise.catch(() => {});
    this.exhausted.promise.catch(() => {});
  }

  /** Resolves once the first channel is created and configured. */
  ready(): Promise<void> {
    return this.firstReady.promise;
  }

  /** Rejects once setup has failed maxAttempts times in a row while the connection was up. */
  failed(): Promise<void> {
    return this.exhausted.promise;
  }

  current(): C | undefined {
    return this.channel;
  }

  isCurrent(channel: C): boolean {
    return this.channel === channel;
  }

  // Safe to call repeatedly: concurrent calls share one attempt.
  open(): Promise<void> {
    this.opening ??= this.attempt().finally(() => (this.opening = undefined));

    return this.opening;
  }

  disableRecovery(): void {
    this.recovering = false;
    clearTimeout(this.retryTimer);
    this.firstReady.reject(new Error("Channel recovery disabled before the channel was ready"));
  }

  close(): Promise<void> {
    this.closing ??= this.closeCurrent();

    return this.closing;
  }

  private async attempt(): Promise<void> {
    if (!this.recovering || this.channel || !this.connection.isUp()) {
      return;
    }

    let channel: C;

    try {
      channel = await this.options.create();
    } catch (error) {
      this.onFailure(error);

      return;
    }

    channel.on("error", (err) => this.logger.error({ err }, "unexpected error on AMQP channel"));
    channel.on("close", () => this.onClose(channel));

    try {
      await this.options.configure(channel);
    } catch (error) {
      await channel.close().catch(() => {});
      this.onFailure(error);

      return;
    }

    if (!this.recovering) {
      await channel.close().catch(() => {});

      return;
    }

    this.channel = channel;
    this.failures = 0;
    this.firstReady.resolve();
  }

  private onClose(channel: C): void {
    // A late close from a replaced or never-activated channel must not clear the current one.
    if (!this.isCurrent(channel)) {
      return;
    }

    this.channel = undefined;
    void this.open();
  }

  private onFailure(error: unknown): void {
    // A connection-level close surfaces as IllegalOperationError; that is not a setup failure.
    if (!(error instanceof Error && error.name === "IllegalOperationError")) {
      this.failures += 1;
    }

    if (this.failures >= this.options.maxAttempts) {
      this.recovering = false;
      this.logger.error({ err: error, attempts: this.failures }, "AMQP channel setup gave up");
      this.firstReady.reject(error);
      this.exhausted.reject(error);

      return;
    }

    if (!this.recovering) {
      return;
    }

    const { initialRetryDelayMs, maxRetryDelayMs } = this.options;
    const exponent = Math.max(0, this.failures - 1);
    const delay = Math.min(maxRetryDelayMs, initialRetryDelayMs * 2 ** exponent);

    this.logger.warn({ err: error, attempt: this.failures, delay }, "AMQP channel setup failed");
    this.retryTimer = setTimeout(() => void this.open(), delay);
  }

  private async closeCurrent(): Promise<void> {
    this.disableRecovery();

    const channel = this.channel;

    this.channel = undefined;
    await channel?.close().catch(() => {});
  }
}
