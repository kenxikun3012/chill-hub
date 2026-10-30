import { z } from "zod";
import { dateTimeSchema, idSchema, optionalText, paginationQuerySchema } from "./common.js";
import { joinRequestStatusSchema, lobbyStatusSchema, lobbyVisibilitySchema, ratingValueSchema } from "./enums.js";

/** In-game party code. Required (LOB-02). */
export const lobbyCodeSchema = z.string().trim().min(1, "Enter the lobby code from the game").max(64);

const lobbyFields = {
  modeId: idSchema,
  lobbyCode: lobbyCodeSchema,
  visibility: lobbyVisibilitySchema,
  /** Total players including the host. */
  capacity: z.number().int().min(2).max(100),
  minRankId: idSchema.nullable().optional(),
  maxRankId: idSchema.nullable().optional(),
  neededRoleIds: z.array(idSchema).max(10).optional(),
  voiceChat: z.boolean().optional(),
  startsAt: dateTimeSchema,
  note: optionalText(300),
};

export const lobbyCreateSchema = z.strictObject({ gameId: idSchema, ...lobbyFields });

/** Host edits (LOB-07). Status can only move forward: in_progress or closed. */
export const lobbyUpdateSchema = z
  .strictObject({ ...lobbyFields, status: z.enum(["in_progress", "closed"]) })
  .partial();

export const lobbiesListQuerySchema = paginationQuerySchema.extend({
  gameId: idSchema.optional(),
  modeId: idSchema.optional(),
  /** Default: "open" when browsing; all active statuses when mine=true. */
  status: lobbyStatusSchema.optional(),
  visibility: lobbyVisibilitySchema.optional(),
  /** Lobbies that need this role. */
  roleId: idSchema.optional(),
  /** Lobbies whose rank range includes this rank. */
  rankId: idSchema.optional(),
  hostId: idSchema.optional(),
  voiceChat: z.stringbool().optional(),
  startsAfter: dateTimeSchema.optional(),
  startsBefore: dateTimeSchema.optional(),
  /** Only lobbies the current user is an active member of (Home's "My upcoming lobbies"). */
  mine: z.stringbool().optional(),
});

export const joinRequestUpdateSchema = z.strictObject({
  status: joinRequestStatusSchema.exclude(["pending"]),
});
export const joinRequestsListQuerySchema = z.object({
  status: joinRequestStatusSchema.default("pending"),
});

export const chatMessageCreateSchema = z.strictObject({
  body: z.string().trim().min(1).max(1000),
});
export const chatMessagesListQuerySchema = paginationQuerySchema;

export const ratingUpsertSchema = z.strictObject({ value: ratingValueSchema });

export type LobbyCreateInput = z.infer<typeof lobbyCreateSchema>;
export type LobbyUpdateInput = z.infer<typeof lobbyUpdateSchema>;
export type LobbiesListQuery = z.infer<typeof lobbiesListQuerySchema>;
export type JoinRequestUpdateInput = z.infer<typeof joinRequestUpdateSchema>;
export type JoinRequestsListQuery = z.infer<typeof joinRequestsListQuerySchema>;
export type ChatMessageCreateInput = z.infer<typeof chatMessageCreateSchema>;
export type ChatMessagesListQuery = z.infer<typeof chatMessagesListQuerySchema>;
export type RatingUpsertInput = z.infer<typeof ratingUpsertSchema>;
