import { BadRequestException, ConflictException } from "@nestjs/common";
import { ACTIVE_LOBBY_STATUSES } from "@chill-hub/shared";
import type { Db } from "../../prisma/prisma.service";

const MAX_START_AHEAD_DAYS = 14;
const START_GRACE_MINUTES = 5;

/** Mode, ranks and roles must belong to the lobby's game, and the rank range must be in order. */
export async function checkLobbyRefs(
  db: Db,
  gameId: string,
  refs: { modeId?: string; minRankId?: string | null; maxRankId?: string | null; neededRoleIds?: string[] },
) {
  if (refs.modeId && !(await db.gameMode.findFirst({ where: { id: refs.modeId, gameId } }))) {
    throw new BadRequestException("That mode doesn't belong to this game");
  }
  const rankIds = [refs.minRankId, refs.maxRankId].filter((r): r is string => !!r);
  const ranks = rankIds.length ? await db.gameRank.findMany({ where: { id: { in: rankIds }, gameId } }) : [];
  if (ranks.length !== new Set(rankIds).size) throw new BadRequestException("That rank doesn't belong to this game");
  const min = ranks.find((r) => r.id === refs.minRankId);
  const max = ranks.find((r) => r.id === refs.maxRankId);
  if (min && max && min.tierOrder > max.tierOrder) {
    throw new BadRequestException("The lowest rank must not be above the highest rank");
  }
  if (refs.neededRoleIds?.length) {
    const unique = [...new Set(refs.neededRoleIds)];
    const count = await db.gameRole.count({ where: { id: { in: unique }, gameId } });
    if (count !== unique.length) throw new BadRequestException("Some roles don't belong to this game");
  }
}

export function checkStartsAt(startsAt: Date) {
  const now = Date.now();
  if (startsAt.getTime() < now - START_GRACE_MINUTES * 60_000) {
    throw new BadRequestException("The start time can't be in the past");
  }
  if (startsAt.getTime() > now + MAX_START_AHEAD_DAYS * 86_400_000) {
    throw new BadRequestException(`Lobbies can be scheduled at most ${MAX_START_AHEAD_DAYS} days ahead`);
  }
}

export function checkCapacity(capacity: number, maxLobbySize: number, memberCount = 1) {
  if (capacity > maxLobbySize) throw new BadRequestException(`This game allows at most ${maxLobbySize} players per lobby`);
  if (capacity < memberCount) throw new BadRequestException(`The lobby already has ${memberCount} players`);
}

/** LOB-13: a player can be in at most N active lobbies at once (hosting counts). */
export async function checkActiveLobbyLimit(db: Db, userId: string, limit: number) {
  const active = await db.lobbyMember.count({
    where: { userId, leftAt: null, lobby: { status: { in: [...ACTIVE_LOBBY_STATUSES] } } },
  });
  if (active >= limit) {
    throw new ConflictException(`You're already in ${active} active lobbies (the limit is ${limit}). Leave one first.`);
  }
}

/** Locks a row for the rest of the transaction so capacity and limit checks can't race. */
export async function lockLobby(db: Db, lobbyId: string) {
  await db.$queryRaw`SELECT id FROM lobbies WHERE id = ${lobbyId} FOR UPDATE`;
}
export async function lockUser(db: Db, userId: string) {
  await db.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

/** Keeps open/full in step with the number of active members (LOB-08). */
export async function syncFullness(db: Db, lobbyId: string) {
  const lobby = await db.lobby.findUniqueOrThrow({ where: { id: lobbyId }, select: { status: true, capacity: true } });
  if (lobby.status !== "open" && lobby.status !== "full") return;
  const members = await db.lobbyMember.count({ where: { lobbyId, leftAt: null } });
  const status = members >= lobby.capacity ? "full" : "open";
  if (status !== lobby.status) await db.lobby.update({ where: { id: lobbyId }, data: { status } });
}

export async function displayNameOf(db: Db, userId: string) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { displayName: true } });
  return profile?.displayName ?? "A player";
}
