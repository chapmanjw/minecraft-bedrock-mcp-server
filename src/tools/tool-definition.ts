import type { z, ZodRawShape } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { SubscriptionRegistry } from "../events/subscription-registry.js";
import type { Logger } from "../observability/logger.js";
import type { CommandQueue } from "../queue/command-queue.js";
import type { StructureFileStore } from "../structures/structure-file-store.js";
import { toCallToolResult } from "./tool-result.js";

/** Services and per-invocation context available to every tool handler. */
export interface ToolContext {
  readonly queue: CommandQueue;
  readonly subscriptions: SubscriptionRegistry;
  readonly structureFiles: StructureFileStore;
  /** The `mcp:` namespace store — `structures/mcp/` — used by `mc_structure_upload`. */
  readonly mcpStructures: StructureFileStore;
  readonly logger: Logger;
  /** Correlates this invocation across logs and any command it enqueues. */
  readonly correlationId: string;
  /** How long a routed command awaits a behavior-pack result. */
  readonly commandTimeoutMs: number;
  /** Aborts when the MCP client cancels the request. */
  readonly signal: AbortSignal;
}

/** A tool handler's return — a result, possibly produced asynchronously. */
export type ToolOutcome = CallToolResult | Promise<CallToolResult>;

/**
 * A registered MCP tool: its schema, metadata, and handler.
 *
 * The generic input shape is erased here; {@link defineQueuedTool} and
 * {@link defineLocalTool} preserve it while a handler is authored.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputShape: ZodRawShape;
  readonly annotations?: ToolAnnotations;
  readonly handler: (input: unknown, context: ToolContext) => ToolOutcome;
}

type InputOf<Shape extends ZodRawShape> = z.infer<z.ZodObject<Shape>>;

/** Configuration for a tool that routes through the command queue. */
export interface QueuedToolConfig<Shape extends ZodRawShape> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputShape: Shape;
  readonly annotations?: ToolAnnotations;
  /** Maps validated input to the bridge command payload. Defaults to identity. */
  readonly toPayload?: (input: InputOf<Shape>) => unknown;
}

/**
 * Defines a tool whose handler validates input, enqueues a command whose
 * `kind` is the tool name, awaits the behavior pack's result, and returns it
 * as a consistent tool envelope.
 */
export function defineQueuedTool<Shape extends ZodRawShape>(
  config: QueuedToolConfig<Shape>,
): ToolDefinition {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputShape: config.inputShape,
    annotations: config.annotations,
    handler: async (input, context) => {
      const payload =
        config.toPayload === undefined ? input : config.toPayload(input as InputOf<Shape>);
      const result = await context.queue.enqueueAndAwait({
        kind: config.name,
        payload,
        correlationId: context.correlationId,
        timeoutMs: context.commandTimeoutMs,
      });
      return toCallToolResult(result);
    },
  };
}

/** Configuration for a tool whose handler runs on the MCP server host. */
export interface LocalToolConfig<Shape extends ZodRawShape> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputShape: Shape;
  readonly annotations?: ToolAnnotations;
  readonly handler: (input: InputOf<Shape>, context: ToolContext) => ToolOutcome;
}

/**
 * Defines a tool whose handler runs locally — filesystem operations, or tools
 * that work directly with the subscription registry.
 */
export function defineLocalTool<Shape extends ZodRawShape>(
  config: LocalToolConfig<Shape>,
): ToolDefinition {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputShape: config.inputShape,
    annotations: config.annotations,
    handler: config.handler as ToolDefinition["handler"],
  };
}
