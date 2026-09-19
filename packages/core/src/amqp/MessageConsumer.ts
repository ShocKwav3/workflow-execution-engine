import type { MessageEnvelope } from "./messages/envelope.js";

export interface InboundMessage {
  envelope: MessageEnvelope;
  redelivered: boolean;
}

export type MessageHandler = (message: InboundMessage) => Promise<void>;

export interface MessageConsumer {
  /** Resolves once subscribed, never merely connected. One instance owns one subscription. */
  consume(handler: MessageHandler): Promise<void>;
  /** Resolves after a normal stop(); rejects when consumption ended unrecoverably. */
  finished(): Promise<void>;
  /** Cancels and drains in-flight handlers. Resources are closed by disposal, not here. */
  stop(): Promise<void>;
}
