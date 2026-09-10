import { createToken } from "@/di/token.js";
import type { AmqpConnectionConfig } from "./config.js";
import type { MessagePublisher } from "./MessagePublisher.js";

export const amqpConnectionConfigToken = createToken<AmqpConnectionConfig>("amqpConnectionConfig");

// Port, not implementation — type-only import above, so importing the token never pulls amqplib in.
export const messagePublisherToken = createToken<MessagePublisher>("messagePublisher");
