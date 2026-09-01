const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// {context} rendered Nest-style ("Context > message") only when bound (logging/contextLogger.ts).
export const PINO_PRETTY_OPTIONS = {
  colorize: true,
  translateTime: "HH:MM:ss",
  ignore: "pid,hostname,context",
  messageFormat: `{if context}${CYAN}{context}${RESET} > {end}{msg}`,
};
