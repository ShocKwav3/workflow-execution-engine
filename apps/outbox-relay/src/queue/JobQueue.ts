export interface AddJobInput {
  name: string;
  data: object;
  jobId: string;
}

export interface JobQueue {
  // False while the connection is down; an add would then fail or wait for the reconnect.
  isReady(): boolean;
  add(input: AddJobInput): Promise<void>;
}
