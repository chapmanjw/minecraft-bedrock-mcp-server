import { randomInt } from "node:crypto";

/**
 * Correlation identifier for a queued command (`cmd_<ULID>`).
 *
 * A plain `string` alias: the wire protocol carries these as strings, and a
 * branded type would force casts at every protocol boundary for no real
 * safety gain here.
 */
export type CommandId = string;

/** Identifier for an event subscription (`sub_<ULID>`). */
export type SubscriptionId = string;

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIMESTAMP_LENGTH = 10;
const RANDOMNESS_LENGTH = 16;

/** Encodes a millisecond timestamp as 10 Crockford base32 characters. */
function encodeTimestamp(timestamp: number): string {
  let remaining = timestamp;
  let encoded = "";
  for (let i = 0; i < TIMESTAMP_LENGTH; i += 1) {
    encoded = CROCKFORD_BASE32.charAt(remaining % 32) + encoded;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

/** Generates 16 Crockford base32 characters of cryptographic randomness. */
function encodeRandomness(): string {
  let encoded = "";
  for (let i = 0; i < RANDOMNESS_LENGTH; i += 1) {
    encoded += CROCKFORD_BASE32.charAt(randomInt(32));
  }
  return encoded;
}

/**
 * Generates a ULID — a 26-character, lexicographically sortable identifier
 * combining a 48-bit timestamp with 80 bits of randomness.
 */
function ulid(): string {
  return encodeTimestamp(Date.now()) + encodeRandomness();
}

/** Creates a new command identifier. */
export function newCommandId(): CommandId {
  return `cmd_${ulid()}`;
}

/** Creates a new subscription identifier. */
export function newSubscriptionId(): SubscriptionId {
  return `sub_${ulid()}`;
}
