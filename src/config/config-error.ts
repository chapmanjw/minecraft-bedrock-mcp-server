/**
 * Raised when server configuration is missing or invalid.
 *
 * A `ConfigError` is fatal: it is thrown during startup, before the server
 * begins listening, and the process exits with a non-zero status.
 */
export class ConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigError";
  }
}
