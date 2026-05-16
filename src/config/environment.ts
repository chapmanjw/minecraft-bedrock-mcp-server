import { z } from "zod";
import { ConfigError } from "./config-error.js";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

/** A boolean parsed from an environment-variable string. */
const EnvBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

const EnvironmentSchema = z.object({
  /** Bind address. `0.0.0.0` is reachable across the LAN. */
  BRIDGE_HOST: z.string().min(1).default("0.0.0.0"),
  /** HTTP/HTTPS port. */
  BRIDGE_PORT: z.coerce.number().int().min(1).max(65535).default(8765),
  /** Path to the TLS certificate PEM. Set together with `BRIDGE_TLS_KEY`. */
  BRIDGE_TLS_CERT: z.string().min(1).optional(),
  /** Path to the TLS private key PEM. Set together with `BRIDGE_TLS_CERT`. */
  BRIDGE_TLS_KEY: z.string().min(1).optional(),
  /** Bearer token for MCP clients on the `/mcp` surface. */
  BRIDGE_CLIENT_TOKEN: z.string().min(1),
  /** Bearer token for the behavior pack on the `/bridge` surface. */
  BRIDGE_AGENT_TOKEN: z.string().min(1),
  /** Absolute path to the active BDS world folder. */
  BRIDGE_WORLD_PATH: z.string().min(1),
  /** Absolute path to the behavior pack folder inside the world. */
  BRIDGE_BEHAVIOR_PACK_PATH: z.string().min(1),
  /** pino log level. */
  BRIDGE_LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  /** Long-poll hold time, in milliseconds, for `GET /bridge/poll`. */
  BRIDGE_POLL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** How long, in milliseconds, a tool call awaits a behavior-pack result. */
  BRIDGE_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  /** Per-token request rate limit, in requests per minute, on `/mcp`. */
  BRIDGE_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(60),
  /** Comma-separated allowed CORS origins; unset disables CORS. */
  BRIDGE_CORS_ORIGINS: z.string().optional(),
  /** Trust `X-Forwarded-*` headers — enable when running behind a reverse proxy. */
  BRIDGE_TRUST_PROXY: EnvBoolean.default("false"),
  /** Maximum accepted request body size, in bytes. */
  BRIDGE_MAX_BODY_BYTES: z.coerce.number().int().positive().default(16 * 1024 * 1024),
  /** Maximum outstanding commands before enqueue fails with `QUEUE_FULL`. */
  BRIDGE_QUEUE_MAX: z.coerce.number().int().positive().default(256),
});

/** Validated server configuration, derived from the process environment. */
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Resolves the configured CORS origins.
 *
 * @returns The list of allowed origins, or `null` when CORS is disabled.
 */
export function corsOrigins(env: Environment): string[] | null {
  if (env.BRIDGE_CORS_ORIGINS === undefined) return null;
  const origins = env.BRIDGE_CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : null;
}

/**
 * Validates the process environment and returns typed configuration.
 *
 * @throws {ConfigError} when a required variable is missing or a value is invalid.
 */
export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = EnvironmentSchema.safeParse(source);
  if (result.success) return result.data;

  const detail = result.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new ConfigError(`invalid configuration:\n${detail}`);
}
