import { ACTIVE_LOBBY_STATUSES, type LobbyStatus } from "@chill-hub/shared";
import { Prisma } from "../../generated/prisma/client";

const PROFILE_SELECT = { select: { displayName: true, avatarUrl: true } } as const;

/** Lobby relations needed for every lobby response, plus the viewer's own membership and join request. */
export function lobbyInclude(viewerId: string) {
  return {
    game: { select: { id: true, slug: true, name: true, maxLobbySize: true } },
    mode: { select: { id: true, name: true } },
    minRank: { select: { id: true, name: true, tierOrder: true } },
    maxRank: { select: { id: true, name: true, tierOrder: true } },
    neededRoles: { select: { gameRole: { select: { id: true, name: true } } } },
    host: { select: { id: true, profile: PROFILE_SELECT } },
    members: { where: { userId: viewerId, leftAt: null }, select: { userId: true } },
    joinRequests: { where: { userId: viewerId }, select: { id: true, status: true } },
    _count: { select: { members: { where: { leftAt: null } } } },
  } satisfies Prisma.LobbyInclude;
}
export type LobbyRow = Prisma.LobbyGetPayload<{ include: ReturnType<typeof lobbyInclude> }>;

export const isActiveStatus = (s: LobbyStatus) => (ACTIVE_LOBBY_STATUSES as readonly LobbyStatus[]).includes(s);

/**
 * NFR-06 / LOB-03 / LOB-09: the one place that decides whether the viewer may see the in-game code.
 * Public lobby: any approved viewer. Private lobby: host and active members only. Closed or expired: nobody.
 */
export function canSeeCode(row: Pick<LobbyRow, "status" | "visibility" | "hostId" | "members">, viewerId: string) {
  if (!isActiveStatus(row.status)) return false;
  const isMember = row.hostId === viewerId || row.members.length > 0;
  return row.visibility === "public" || isMember;
}

export function toLobbyView(row: LobbyRow, viewerId: string) {
  const codeVisible = canSeeCode(row, viewerId);
  return {
    id: row.id,
    status: row.status,
    visibility: row.visibility,
    game: row.game,
    mode: row.mode,
    capacity: row.capacity,
    memberCount: row._count.members,
    minRank: row.minRank,
    maxRank: row.maxRank,
    neededRoles: row.neededRoles.map((n) => n.gameRole),
    voiceChat: row.voiceChat,
    startsAt: row.startsAt,
    note: row.note,
    host: { id: row.host.id, displayName: row.host.profile?.displayName ?? null, avatarUrl: row.host.profile?.avatarUrl ?? null },
    lobbyCode: codeVisible ? row.lobbyCode : null,
    codeVisible,
    viewer: {
      isHost: row.hostId === viewerId,
      isMember: row.members.length > 0,
      joinRequestStatus: row.joinRequests[0]?.status ?? null,
      joinRequestId: row.joinRequests[0]?.id ?? null,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}
export type LobbyView = ReturnType<typeof toLobbyView>;
