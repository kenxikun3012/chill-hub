export interface Named {
  id: string;
  name: string;
}

export interface LobbyGame extends Named {
  teamSize: number;
  maxLobbySize: number;
  inGameIdLabel: string;
  ranks: Named[]; // lowest first
  roles: Named[];
  modes: Named[];
}

export interface Lobby {
  id: string;
  status: "open" | "full" | "in_progress" | "closed" | "expired";
  visibility: "public" | "private";
  game: Named;
  mode: Named;
  capacity: number;
  memberCount: number;
  minRank: Named | null;
  maxRank: Named | null;
  neededRoles: Named[];
  voiceChat: boolean;
  startsAt: string;
  note: string | null;
  host: { id: string; displayName: string | null };
  /** Null when this viewer may not see it (NFR-06). */
  lobbyCode: string | null;
  viewer: {
    isHost: boolean;
    isMember: boolean;
    joinRequestStatus: "pending" | "accepted" | "declined" | "cancelled" | null;
    joinRequestId: string | null;
  };
}

export interface LobbyMember {
  userId: string;
  displayName: string | null;
  isHost: boolean;
}

export interface LobbyDetail extends Lobby {
  members: LobbyMember[];
}

export interface JoinRequest {
  id: string;
  player: {
    userId: string;
    displayName: string | null;
    inGameAccount: { inGameName: string; rank: Named | null; preferredRoles: Named[] } | null;
    reputation?: { good: number; noShow: number };
  };
}

export interface ChatMessage {
  id: string;
  kind: "user" | "system";
  body: string;
  createdAt: string;
  sender: { userId: string; displayName: string | null } | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const isActive = (lobby: Pick<Lobby, "status">) => lobby.status === "open" || lobby.status === "full" || lobby.status === "in_progress";

export const rankRange = (lobby: Pick<Lobby, "minRank" | "maxRank">) => {
  if (!lobby.minRank && !lobby.maxRank) return "Any rank";
  if (lobby.minRank && lobby.maxRank) return lobby.minRank.id === lobby.maxRank.id ? lobby.minRank.name : `${lobby.minRank.name} – ${lobby.maxRank.name}`;
  return lobby.minRank ? `${lobby.minRank.name} and above` : `Up to ${lobby.maxRank!.name}`;
};

const clock = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** "Starts now", "Today, 8:00 PM" or "Tomorrow, 9:30 AM". Lobbies start within a day, so nothing else is needed. */
export function startLabel(startsAt: string, now = new Date()) {
  const date = new Date(startsAt);
  if (date.getTime() <= now.getTime()) return "Started";
  if (date.getTime() - now.getTime() < 5 * 60_000) return "Starts now";
  return `${date.toDateString() === now.toDateString() ? "Today" : "Tomorrow"}, ${clock(date)}`;
}

/**
 * Reads "20:30", "8:30 pm" or "8pm" as the next time that clock time comes round,
 * which is always within the 24-hour scheduling limit. Null when it can't be read.
 */
export function nextOccurrence(text: string, now = new Date()): Date | null {
  const match = text.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (suffix === "pm" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}
