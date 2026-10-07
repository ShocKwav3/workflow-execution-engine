import { Queue } from "bullmq";
import type { Disposable } from "@workflow-engine/core/di/types.js";
import type { RedisConnection } from "@workflow-engine/core/redis/RedisConnection.js";
import { startWorkflowExecutionJobContract } from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import type { AddJobInput, JobQueue } from "./JobQueue.js";

// Completed jobs bound the jobId dedupe window; failed jobs are kept for inspection.
export const JOB_RETENTION = {
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: false,
} as const;

export class BullMqJobQueue implements JobQueue, Disposable {
  private readonly queue: Queue;

  // A passed-in client is shared: BullMQ never closes it, the connection's owner does.
  constructor(private readonly connection: RedisConnection) {
    this.queue = new Queue(startWorkflowExecutionJobContract.queueName, {
      connection: connection.client,
      defaultJobOptions: JOB_RETENTION,
    });

    // BullMQ re-emits connection errors here; the connection's monitor already logs them.
    this.queue.on("error", () => {});
  }

  isReady(): boolean {
    return this.connection.isReady();
  }

  async add({ name, data, jobId }: AddJobInput): Promise<void> {
    await this.queue.add(name, data, { jobId });
  }

  async dispose(): Promise<void> {
    await this.queue.close();
  }
}
