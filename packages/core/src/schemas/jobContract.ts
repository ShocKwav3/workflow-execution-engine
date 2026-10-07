import type { ZodType } from "zod";

export interface JobDataIssue {
  path: PropertyKey[];
  message: string;
}

export type JobDataParseResult<TData> =
  { success: true; data: TData } | { success: false; issues: JobDataIssue[] };

// One object per job type, so a queue, its job name and its data shape cannot be paired wrongly.
export interface JobContract<TData> {
  readonly queueName: string;
  readonly jobName: string;
  parse(data: unknown): JobDataParseResult<TData>;
}

export function defineJobContract<TData>(definition: {
  queueName: string;
  jobName: string;
  schema: ZodType<TData>;
}): JobContract<TData> {
  const { queueName, jobName, schema } = definition;

  return {
    queueName,
    jobName,
    parse(data) {
      const result = schema.safeParse(data);

      return result.success
        ? { success: true, data: result.data }
        : {
            success: false,
            issues: result.error.issues.map(({ path, message }) => ({ path, message })),
          };
    },
  };
}
