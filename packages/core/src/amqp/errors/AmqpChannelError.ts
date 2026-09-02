import { AmqpError } from "./AmqpError.js";

export class AmqpChannelError extends AmqpError {
  constructor(cause: unknown) {
    super("AMQP_CHANNEL_UNAVAILABLE", "AMQP channel closed unexpectedly", cause);
    this.name = "AmqpChannelError";
  }
}
