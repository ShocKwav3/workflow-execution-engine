import { AmqpError } from "./AmqpError.js";

export class AmqpConnectionError extends AmqpError {
  constructor(cause: unknown) {
    super("AMQP_CONNECTION_UNAVAILABLE", "AMQP connection unavailable", cause);
    this.name = "AmqpConnectionError";
  }
}
