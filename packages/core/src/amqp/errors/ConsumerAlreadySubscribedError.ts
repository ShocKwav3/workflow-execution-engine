// Not an AmqpError: the broker is healthy and retrying never helps, so UNAVAILABLE would be a lie.
export class ConsumerAlreadySubscribedError extends Error {
  constructor(queue: string) {
    super(`Consumer for queue ${queue} is already subscribed`);
    this.name = "ConsumerAlreadySubscribedError";
    Error.captureStackTrace(this, this.constructor);
  }
}
