import { z } from "zod";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const ObjectiveSchema = z.string().min(1).describe("Scoreboard objective id.");
const ParticipantSchema = z
  .string()
  .min(1)
  .describe("A player name or other scoreboard identity.");

/** Scoreboard objective and score operations. */
export const scoreboardTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_scoreboard_list_objectives",
    title: "List scoreboard objectives",
    description: "Returns every scoreboard objective.",
    inputShape: {},
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_add_objective",
    title: "Add a scoreboard objective",
    description: "Creates a scoreboard objective.",
    inputShape: {
      id: ObjectiveSchema,
      display_name: z.string().optional(),
      criteria: z.string().optional().describe("Objective criteria; defaults to dummy."),
    },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_remove_objective",
    title: "Remove a scoreboard objective",
    description: "Deletes a scoreboard objective.",
    inputShape: { id: ObjectiveSchema },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_get_score",
    title: "Get a score",
    description: "Returns a participant's score for an objective.",
    inputShape: { objective: ObjectiveSchema, participant: ParticipantSchema },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_set_score",
    title: "Set a score",
    description: "Sets a participant's score for an objective.",
    inputShape: {
      objective: ObjectiveSchema,
      participant: ParticipantSchema,
      score: z.number().int(),
    },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_add_score",
    title: "Add to a score",
    description: "Adds an amount to a participant's score; pass a negative amount to subtract.",
    inputShape: {
      objective: ObjectiveSchema,
      participant: ParticipantSchema,
      amount: z.number().int(),
    },
  }),
  defineQueuedTool({
    name: "mc_scoreboard_reset_participant",
    title: "Reset a participant",
    description: "Removes a participant's scores, from one objective or from all of them.",
    inputShape: {
      participant: ParticipantSchema,
      objective: ObjectiveSchema.optional().describe("Omit to reset across every objective."),
    },
  }),
];
