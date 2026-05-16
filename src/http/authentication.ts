import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Which bearer token a request scope requires. */
export type AuthScope = "client" | "agent";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Constant-time bearer token comparison.
 *
 * Both tokens are reduced to fixed-width SHA-256 digests first, so the
 * comparison time does not leak the provided token's length.
 */
function tokensMatch(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

function extractBearerToken(header: string | undefined): string | undefined {
  const prefix = "Bearer ";
  if (header === undefined || !header.startsWith(prefix)) return undefined;
  return header.slice(prefix.length);
}

/**
 * Builds a Fastify `onRequest` hook that enforces a single bearer token.
 *
 * On failure it responds `401` with no body, a `WWW-Authenticate` header, and
 * a warning log line carrying the source IP — never the token itself.
 */
export function bearerAuth(scope: AuthScope, expectedToken: string) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);
    if (token !== undefined && tokensMatch(token, expectedToken)) {
      return;
    }
    request.log.warn(
      { scope, ip: request.ip, method: request.method, url: request.url },
      "rejected unauthenticated request",
    );
    await reply.code(401).header("WWW-Authenticate", `Bearer realm="${scope}"`).send();
  };
}
