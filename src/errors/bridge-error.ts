import type { ErrorCode } from "./error-codes.js";

/** Construction options for a {@link BridgeError}. */
export interface BridgeErrorOptions {
  /** Stable, machine-readable error code. */
  readonly code: ErrorCode;
  /** Human-readable description. Safe to log. */
  readonly message: string;
  /** Optional structured diagnostic context. Must be JSON-serializable. */
  readonly details?: unknown;
  /** Hint, in milliseconds, after which a retry may succeed (throttling, rate limits). */
  readonly retryAfterMs?: number;
  /** Underlying cause, preserved for logging. */
  readonly cause?: unknown;
}

/** The serializable, wire-safe projection of a {@link BridgeError}. */
export interface SerializedBridgeError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * An error carrying a stable {@link ErrorCode}.
 *
 * Every failure that crosses a layer boundary — a tool result, an HTTP
 * response, a bridge result — is represented as a `BridgeError` so the code is
 * preserved end to end and can be mapped to a consistent response envelope.
 */
export class BridgeError extends Error {
  /** Stable, machine-readable error code. */
  readonly code: ErrorCode;
  /** Structured diagnostic context, or `undefined` when none was provided. */
  readonly details: unknown;
  /** Retry hint in milliseconds, or `undefined` when retrying will not help. */
  readonly retryAfterMs: number | undefined;

  constructor(options: BridgeErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "BridgeError";
    this.code = options.code;
    this.details = options.details;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** Type guard for `BridgeError`, safe across module boundaries. */
  static is(value: unknown): value is BridgeError {
    return value instanceof BridgeError;
  }

  /** Projects the error to its serializable, wire-safe shape. */
  serialize(): SerializedBridgeError {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}
