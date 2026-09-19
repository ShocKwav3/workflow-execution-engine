import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { UnprocessableMessageError } from "@workflow-engine/core/amqp/errors/index.js";
import type { MessageEnvelope } from "@workflow-engine/core/amqp/messages/envelope.js";
import { createStartWorkflowExecutionMessage } from "@workflow-engine/core/amqp/messages/startWorkflowExecution.js";
import type { Logger } from "@workflow-engine/core/logging/types.js";
import { StartWorkflowExecutionHandler } from "@/StartWorkflowExecutionHandler.js";

const recordingLogger = () => {
  const infos: { obj: unknown; msg?: string }[] = [];
  const logger: Logger = {
    child: () => logger,
    info: (obj, msg) => infos.push({ obj, msg }),
    warn: () => {},
    error: () => {},
    fatal: () => {},
  };

  return { logger, infos };
};

describe("StartWorkflowExecutionHandler", () => {
  it("logs the delivery with its identifiers", async () => {
    const { logger, infos } = recordingLogger();
    const workflowExecutionId = randomUUID();
    const envelope = createStartWorkflowExecutionMessage(workflowExecutionId);

    await new StartWorkflowExecutionHandler(logger).handle({ envelope, redelivered: true });

    expect(infos).toEqual([
      {
        obj: {
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          workflowExecutionId,
          redelivered: true,
        },
        msg: "StartWorkflowExecution received",
      },
    ]);
  });

  it.each<[string, Partial<MessageEnvelope>]>([
    ["an unknown type", { type: "SomethingElse" }],
    ["a payload that breaks the contract", { payload: { workflowExecutionId: "not-a-uuid" } }],
    ["a missing payload", { payload: undefined }],
  ])("declares %s unprocessable", async (_, overrides) => {
    const { logger, infos } = recordingLogger();
    const envelope = { ...createStartWorkflowExecutionMessage(randomUUID()), ...overrides };

    await expect(
      new StartWorkflowExecutionHandler(logger).handle({ envelope, redelivered: false }),
    ).rejects.toBeInstanceOf(UnprocessableMessageError);

    expect(infos).toHaveLength(0);
  });
});
