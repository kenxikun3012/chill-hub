import type { NotificationGroup, NotificationType } from "@chill-hub/shared";

/** Which preference group a notification type belongs to (NOT-03). */
export const NOTIFICATION_TYPE_GROUP: Record<NotificationType, NotificationGroup> = {
  account_approved: "account",
  account_rejected: "account",
  join_request_received: "lobbies",
  join_request_accepted: "lobbies",
  join_request_declined: "lobbies",
  lobby_member_joined: "lobbies",
  lobby_member_left: "lobbies",
  lobby_code_changed: "lobbies",
  lobby_starting_soon: "lobbies",
  lobby_closed: "lobbies",
  rate_teammates: "lobbies",
  chat_message: "lobby_chat",
};

export interface Channels {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

/** Defaults when a user has no saved preference for a group. Account notifications can't be turned off. */
export const PREFERENCE_DEFAULTS: Record<NotificationGroup, Channels> = {
  account: { push: true, email: true, inApp: true },
  lobbies: { push: true, email: false, inApp: true },
  lobby_chat: { push: false, email: false, inApp: false },
  knowledge: { push: true, email: false, inApp: true },
  news: { push: false, email: false, inApp: true },
};

/** A user's channels for a group. Chat is push only: it lives in the lobby, not the inbox or email. */
export function channelsFor(group: NotificationGroup, saved?: Channels): Channels {
  if (group === "account") return PREFERENCE_DEFAULTS.account;
  const values = saved ?? PREFERENCE_DEFAULTS[group];
  return group === "lobby_chat" ? { push: values.push, email: false, inApp: false } : values;
}
