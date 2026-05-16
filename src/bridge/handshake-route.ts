import type { FastifyInstance } from "fastify";
import {
  HandshakeRequestSchema,
  PROTOCOL_VERSION,
  isProtocolCompatible,
  type HandshakeResponse,
} from "../protocol/index.js";

/**
 * Registers `POST /handshake` (mounted at `/bridge/handshake`).
 *
 * Negotiates the bridge protocol version on behavior-pack startup. A pack
 * whose major version differs is refused with `409`.
 */
export function registerHandshakeRoute(
  app: FastifyInstance,
  serverVersion: string,
  pollTimeoutMs: number,
): void {
  app.post("/handshake", (request, reply) => {
    const parsed = HandshakeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "INVALID_INPUT", message: "malformed handshake request" } });
    }

    if (!isProtocolCompatible(parsed.data.protocol_version)) {
      request.log.warn(
        { peerProtocolVersion: parsed.data.protocol_version },
        "refused behavior pack with incompatible bridge protocol",
      );
      const rejection: HandshakeResponse = {
        accepted: false,
        reason: `incompatible bridge protocol version '${parsed.data.protocol_version}'`,
        server_protocol_version: PROTOCOL_VERSION,
      };
      return reply.code(409).send(rejection);
    }

    request.log.info(
      {
        worldId: parsed.data.world_id,
        behaviorPackVersion: parsed.data.behavior_pack_version,
        minecraftVersion: parsed.data.minecraft_version,
      },
      "behavior pack connected",
    );
    const acceptance: HandshakeResponse = {
      accepted: true,
      server_version: serverVersion,
      protocol_version: PROTOCOL_VERSION,
      poll_timeout_ms: pollTimeoutMs,
      resync_subscriptions: [],
    };
    return reply.code(200).send(acceptance);
  });
}
