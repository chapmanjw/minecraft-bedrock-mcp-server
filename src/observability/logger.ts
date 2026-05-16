import { pino, type Logger } from "pino";

export type { Logger };

/** Options for {@link createLogger}. */
export interface LoggerOptions {
  /** pino log level. */
  readonly level: string;
  /** When true, render human-readable logs via `pino-pretty` (development). */
  readonly pretty: boolean;
}

/**
 * Creates the application's root structured logger.
 *
 * Bearer tokens and `Authorization` headers are redacted from every log line.
 */
export function createLogger(options: LoggerOptions): Logger {
  return pino({
    level: options.level,
    redact: {
      paths: ["req.headers.authorization", "headers.authorization", "authorization", "*.token"],
      remove: true,
    },
    ...(options.pretty
      ? { transport: { target: "pino-pretty", options: { translateTime: "SYS:standard" } } }
      : {}),
  });
}
