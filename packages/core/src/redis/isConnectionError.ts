// Codes Node sets when a connection cannot be made or is lost; a lost job lock carries none of them.
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
]);

// The message ioredis and BullMQ use for a command on a closed connection.
const CONNECTION_CLOSED_MESSAGE = "Connection is closed.";

export function isConnectionError(error: Error & { code?: string }): boolean {
  return (
    (error.code !== undefined && CONNECTION_ERROR_CODES.has(error.code)) ||
    error.message === CONNECTION_CLOSED_MESSAGE
  );
}
