import type { JobContract } from "@workflow-engine/core/schemas/jobContract.js";

export interface JobContext {
  jobId: string;
}

// The handler names the contract it handles, so the consumer cannot be wired to the wrong queue or schema.
export interface JobHandler<TData, TResult> {
  readonly contract: JobContract<TData>;
  handle(data: TData, job: JobContext): Promise<TResult>;
}
