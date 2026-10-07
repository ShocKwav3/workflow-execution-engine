import { type Job, UnrecoverableError, Worker } from "bullmq";
import type { Disposable } from "@workflow-engine/core/di/types.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import type { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import type { JobHandler } from "./JobHandler.js";

export interface BullMqConsumerOptions {
  concurrency: number;
}

// Transport only: validates the job envelope and hands the parsed data to its handler.
export class BullMqConsumer<TData, TResult> implements Disposable {
  private readonly worker: Worker<unknown, TResult>;

  // The Worker duplicates the passed client for its own connections and closes those copies itself.
  constructor(
    connection: RedisConnection,
    private readonly handler: JobHandler<TData, TResult>,
    options: BullMqConsumerOptions,
    private readonly logger: Logger,
  ) {
    const { queueName } = handler.contract;

    this.worker = new Worker(queueName, (job) => this.process(job), {
      connection: connection.client,
      concurrency: options.concurrency,
      autorun: false,
    });

    // Also the only place a lost job lock surfaces ("could not renew lock", "Lock mismatch").
    this.worker.on("error", (error) =>
      this.logger.error({ queueName, err: error }, "worker error"),
    );
  }

  // A rejected run() reaches the process's unhandledRejection handler, which shuts down.
  start(): void {
    void this.worker.run();
  }

  async dispose(): Promise<void> {
    await this.worker.close();
  }

  private async process(job: Job<unknown, TResult>): Promise<TResult> {
    const jobId = job.id!;
    const ids = { jobId, jobName: job.name };

    const { contract } = this.handler;

    if (job.name !== contract.jobName) {
      this.logger.error(ids, "unsupported job name");
      throw new UnrecoverableError(`unsupported job name: ${job.name}`);
    }

    const parsed = contract.parse(job.data);

    if (!parsed.success) {
      this.logger.error({ ...ids, issues: parsed.issues }, "invalid job data");
      throw new UnrecoverableError(`invalid ${job.name} job data`);
    }

    this.logger.info({ ...ids, stalledCounter: job.stalledCounter }, "job received");

    try {
      return await this.handler.handle(parsed.data, { jobId });
    } catch (error) {
      this.logger.error({ ...ids, err: error }, "job failed");
      throw error;
    }
  }
}
