import type { Channel, ChannelModel, ConfirmChannel } from "amqplib";
import { createToken } from "@/di/token.js";

// Ports, not implementations — type-only imports above, so importing a token never pulls amqplib in.
export const amqpConnectionToken = createToken<ChannelModel>("amqpConnection");

export const amqpChannelToken = createToken<Channel>("amqpChannel");

export const amqpConfirmChannelToken = createToken<ConfirmChannel>("amqpConfirmChannel");
