import type { OutboxClaimer } from "@workflow-engine/core/db/outbox/OutboxClaimer.js";
import type { ClaimedOutboxMessageRow } from "@workflow-engine/core/db/types.js";
import { parseInternal } from "@workflow-engine/core/errors/index.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { OUTBOX_DESTINATION } from "@workflow-engine/core/schemas/outboxMessage.schemas.js";
import {
  START_WORKFLOW_EXECUTION,
  type StartWorkflowExecutionJob,
  startWorkflowExecutionJobSchema,
} from "@workflow-engine/core/schemas/startWorkflowExecutionJob.schemas.js";
import type { OutboxRelayConfig } from "./config.js";
import type { JobQueue } from "./queue/JobQueue.js";

export class OutboxRelay {
  constructor(
    private readonly claimer: OutboxClaimer,
    private readonly jobQueue: JobQueue,
    private readonly config: OutboxRelayConfig,
    private readonly logger: Logger,
  ) {}

  // Returns true when the batch was full, i.e. more rows are probably waiting.
  async relayBatch(): Promise<boolean> {
    // A claimed row that cannot be published stays stranded until its lease expires.
    if (!this.jobQueue.isReady()) {
      return false;
    }

    const rows = await this.claimer.claimOutboxMessages({
      destination: OUTBOX_DESTINATION.bullmq,
      batchSize: this.config.batchSize,
      leaseMs: this.config.leaseMs,
    });

    await Promise.all(rows.map((row) => this.relayRow(row)));

    return rows.length === this.config.batchSize;
  }

  // Every failure leaves the row PROCESSING; lease expiry makes it claimable again.
  private async relayRow(row: ClaimedOutboxMessageRow): Promise<void> {
    const logger = this.logger.child({
      outboxMessageId: row.id,
      correlationId: row.correlation_id,
      attempts: row.attempts,
    });

    if (row.message_type !== START_WORKFLOW_EXECUTION) {
      logger.error(
        { messageType: row.message_type },
        "unsupported outbox message type; left for lease expiry",
      );

      return;
    }

    let job: StartWorkflowExecutionJob;

    try {
      job = parseInternal(startWorkflowExecutionJobSchema, row.payload, "OutboxRelay.relayRow");
    } catch (error) {
      logger.error({ err: error }, "invalid outbox payload; left for lease expiry");

      return;
    }

    const jobLogger = logger.child({ executionId: job.executionId });

    try {
      await this.jobQueue.add({ name: row.message_type, data: job, jobId: job.executionId });
    } catch (error) {
      jobLogger.warn(
        { err: error },
        "failed to publish outbox message; retried after lease expiry",
      );

      return;
    }

    try {
      const settled = await this.claimer.markOutboxMessagePublished({
        id: row.id,
        claimToken: row.claim_token,
      });

      if (!settled) {
        jobLogger.warn(
          {},
          "published, but the claim was lost; another claimer may publish it again",
        );

        return;
      }

      jobLogger.info({}, "published outbox message");
    } catch (error) {
      jobLogger.error(
        { err: error },
        "published, but failed to mark it PUBLISHED; it will be published again",
      );
    }
  }
}
