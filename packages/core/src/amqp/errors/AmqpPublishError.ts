import { AmqpError } from "./AmqpError.js";

export class AmqpPublishError extends AmqpError {
  constructor(cause: unknown) {
    super("AMQP_PUBLISH_FAILED", "AMQP message could not be published", cause);
    this.name = "AmqpPublishError";
  }
}
