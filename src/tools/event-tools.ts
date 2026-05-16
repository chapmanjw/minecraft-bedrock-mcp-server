import { z } from "zod";
import { SubscriptionIdSchema } from "../protocol/index.js";
import { defineLocalTool, type ToolDefinition } from "./tool-definition.js";
import { toolError, toolSuccess } from "./tool-result.js";

/** Event subscription tools — these manage the local subscription registry. */
export const eventTools: readonly ToolDefinition[] = [
  defineLocalTool({
    name: "mc_event_subscribe",
    title: "Subscribe to a world event",
    description:
      "Starts capturing a world event type (chatSend, playerJoin, blockBreak, " +
      "and so on). Returns a subscription id to drain with mc_event_poll.",
    inputShape: {
      event_type: z.string().min(1),
      filter: z.record(z.unknown()).optional(),
    },
    handler: async (input, context) => {
      const subscription = context.subscriptions.create(input.event_type, input.filter ?? null);
      try {
        await context.queue.enqueueAndAwait({
          kind: "mc_event_subscribe",
          payload: {
            subscription_id: subscription.id,
            event_type: input.event_type,
            filter: input.filter ?? null,
          },
          correlationId: context.correlationId,
          timeoutMs: context.commandTimeoutMs,
        });
      } catch (error) {
        context.subscriptions.remove(subscription.id);
        throw error;
      }
      return toolSuccess({ subscription_id: subscription.id, event_type: input.event_type });
    },
  }),
  defineLocalTool({
    name: "mc_event_unsubscribe",
    title: "Unsubscribe from a world event",
    description: "Stops capturing events for a subscription and discards its buffer.",
    inputShape: { subscription_id: SubscriptionIdSchema },
    handler: async (input, context) => {
      const wasActive = context.subscriptions.remove(input.subscription_id);
      await context.queue.enqueueAndAwait({
        kind: "mc_event_unsubscribe",
        payload: { subscription_id: input.subscription_id },
        correlationId: context.correlationId,
        timeoutMs: context.commandTimeoutMs,
      });
      return toolSuccess({ subscription_id: input.subscription_id, was_active: wasActive });
    },
  }),
  defineLocalTool({
    name: "mc_event_list_subscriptions",
    title: "List event subscriptions",
    description: "Lists active event subscriptions and how many events each has buffered.",
    inputShape: {},
    annotations: { readOnlyHint: true },
    handler: (_input, context) => toolSuccess({ subscriptions: context.subscriptions.list() }),
  }),
  defineLocalTool({
    name: "mc_event_poll",
    title: "Poll buffered events",
    description:
      "Drains buffered events for a subscription. Pass the returned cursor to " +
      "the next poll to receive only newer events.",
    inputShape: {
      subscription_id: SubscriptionIdSchema,
      since_cursor: z
        .string()
        .regex(/^\d+$/)
        .optional()
        .describe("Cursor from a previous poll; omit to read from the start."),
    },
    annotations: { readOnlyHint: true },
    handler: (input, context) => {
      if (context.subscriptions.get(input.subscription_id) === undefined) {
        return toolError("NOT_FOUND", `no subscription '${input.subscription_id}'`);
      }
      const page = context.subscriptions.poll(input.subscription_id, input.since_cursor);
      return toolSuccess({ events: page.events, cursor: page.cursor });
    },
  }),
];
