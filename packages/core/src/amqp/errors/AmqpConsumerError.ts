import { AmqpError } from "./AmqpError.js";

export class AmqpConsumerError extends AmqpError {
  constructor(cause: unknown) {
    super("AMQP_CONSUMER_FAILED", "AMQP consumer could not be established", cause);
    this.name = "AmqpConsumerError";
  }
}
