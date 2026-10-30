// Mirrors of the PostgreSQL enums in apps/api/prisma/schema.prisma.
// A test in the API checks that these stay identical to the Prisma enums.
import { z } from "zod";

export const USER_STATUSES = ["pending", "approved", "rejected", "suspended", "banned"] as const;
export const ROLE_NAMES = ["player", "moderator", "organizer", "admin"] as const;
export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export const DEVICE_PLATFORMS = ["ios", "android", "web"] as const;
export const LOBBY_VISIBILITIES = ["public", "private"] as const;
export const LOBBY_STATUSES = ["open", "full", "in_progress", "closed", "expired"] as const;
export const JOIN_REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
export const CHAT_MESSAGE_KINDS = ["user", "system"] as const;
export const RATING_VALUES = ["good", "no_show"] as const;
export const NOTIFICATION_GROUPS = ["account", "lobbies", "lobby_chat", "knowledge", "news"] as const;
export const NOTIFICATION_TYPES = [
  "account_approved",
  "account_rejected",
  "join_request_received",
  "join_request_accepted",
  "join_request_declined",
  "lobby_member_joined",
  "lobby_member_left",
  "lobby_code_changed",
  "lobby_starting_soon",
  "lobby_closed",
  "rate_teammates",
  "chat_message",
] as const;

export const userStatusSchema = z.enum(USER_STATUSES);
export const roleNameSchema = z.enum(ROLE_NAMES);
export const approvalStatusSchema = z.enum(APPROVAL_STATUSES);
export const devicePlatformSchema = z.enum(DEVICE_PLATFORMS);
export const lobbyVisibilitySchema = z.enum(LOBBY_VISIBILITIES);
export const lobbyStatusSchema = z.enum(LOBBY_STATUSES);
export const joinRequestStatusSchema = z.enum(JOIN_REQUEST_STATUSES);
export const chatMessageKindSchema = z.enum(CHAT_MESSAGE_KINDS);
export const ratingValueSchema = z.enum(RATING_VALUES);
export const notificationGroupSchema = z.enum(NOTIFICATION_GROUPS);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type UserStatus = z.infer<typeof userStatusSchema>;
export type RoleName = z.infer<typeof roleNameSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
export type LobbyVisibility = z.infer<typeof lobbyVisibilitySchema>;
export type LobbyStatus = z.infer<typeof lobbyStatusSchema>;
export type JoinRequestStatus = z.infer<typeof joinRequestStatusSchema>;
export type ChatMessageKind = z.infer<typeof chatMessageKindSchema>;
export type RatingValue = z.infer<typeof ratingValueSchema>;
export type NotificationGroup = z.infer<typeof notificationGroupSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/** Lobby statuses that count as "active" for limits and Home's "My upcoming lobbies". */
export const ACTIVE_LOBBY_STATUSES = ["open", "full", "in_progress"] as const satisfies readonly LobbyStatus[];
