/**
 * Version of the bridge protocol implemented by this server — the contract
 * between the MCP server and the BDS behavior pack.
 *
 * Semantic versioning applies. The behavior pack and server are compatible
 * when they share the same major version; the major is negotiated during the
 * handshake (see `handshake.ts`).
 */
export const PROTOCOL_VERSION = "1.0.0";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/** Extracts the major version from a semver string, or `null` if unparseable. */
export function parseMajor(version: string): number | null {
  const match = SEMVER.exec(version);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Whether a peer's protocol version is compatible with this server's.
 *
 * Compatibility requires an equal, parseable major version.
 */
export function isProtocolCompatible(peerVersion: string): boolean {
  const peerMajor = parseMajor(peerVersion);
  const ourMajor = parseMajor(PROTOCOL_VERSION);
  return peerMajor !== null && ourMajor !== null && peerMajor === ourMajor;
}
