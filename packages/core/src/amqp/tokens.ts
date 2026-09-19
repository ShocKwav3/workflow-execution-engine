import { createToken } from "@/di/token.js";
import type { AmqpConnection } from "./AmqpConnection.js";
import type { AmqpConnectionConfig } from "./config.js";
import type { MessageConsumer } from "./MessageConsumer.js";
import type { MessagePublisher } from "./MessagePublisher.js";

export const amqpConnectionConfigToken = createToken<AmqpConnectionConfig>("amqpConnectionConfig");

// A concrete resource, like the pg pool — the container owns closing it.
export const amqpConnectionToken = createToken<AmqpConnection>("amqpConnection");

// Port, not implementation — type-only import above, so importing the token never pulls amqplib in.
export const messagePublisherToken = createToken<MessagePublisher>("messagePublisher");

export const messageConsumerToken = createToken<MessageConsumer>("messageConsumer");
