/** Result of a denied admission: how long until a retry may succeed. */
export interface ThrottleDecision {
  readonly retryAfterMs: number;
}

/** Token-bucket rate-limit policy for a command kind. */
export interface ThrottlePolicy {
  /** Sustained admissions per second. */
  readonly ratePerSecond: number;
  /** Bucket capacity — the largest burst admitted at once. */
  readonly burst: number;
}

/** Configuration for {@link createCommandThrottle}. */
export interface CommandThrottleOptions {
  /** Policy applied to any kind without a specific override. */
  readonly defaultPolicy: ThrottlePolicy;
  /** Per-kind policy overrides, keyed by command kind. */
  readonly perKindPolicy?: Readonly<Record<string, ThrottlePolicy>>;
  /** Clock source, injectable for tests. Defaults to `Date.now`. */
  readonly now?: () => number;
}

/**
 * Per-kind rate limiter for the bridge enqueue path.
 *
 * Each command kind gets an independent token bucket, shielding the behavior
 * pack's script watchdog from bursts of expensive commands.
 */
export interface CommandThrottle {
  /**
   * Attempts to admit one command of the given kind.
   *
   * @returns `null` when admitted; a {@link ThrottleDecision} when the kind's
   *   bucket is empty.
   */
  tryAdmit(kind: string): ThrottleDecision | null;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Creates a {@link CommandThrottle} from the given policy. */
export function createCommandThrottle(options: CommandThrottleOptions): CommandThrottle {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function policyFor(kind: string): ThrottlePolicy {
    return options.perKindPolicy?.[kind] ?? options.defaultPolicy;
  }

  return {
    tryAdmit(kind) {
      const policy = policyFor(kind);
      const at = now();
      const bucket = buckets.get(kind) ?? { tokens: policy.burst, updatedAt: at };

      const elapsedSeconds = Math.max(0, at - bucket.updatedAt) / 1000;
      bucket.tokens = Math.min(
        policy.burst,
        bucket.tokens + elapsedSeconds * policy.ratePerSecond,
      );
      bucket.updatedAt = at;
      buckets.set(kind, bucket);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return null;
      }

      const retryAfterMs = Math.ceil(((1 - bucket.tokens) / policy.ratePerSecond) * 1000);
      return { retryAfterMs };
    },
  };
}
