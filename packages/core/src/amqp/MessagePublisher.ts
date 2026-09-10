export interface OutboundMessage {
  messageId: string;
  routingKey: string;
  body: unknown;
}

export interface MessagePublisher {
  publish(message: OutboundMessage): Promise<void>;
  isAvailable(): boolean;
}
