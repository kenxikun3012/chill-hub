import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ACTIVE_LOBBY_STATUSES, type LobbiesListQuery, type LobbyCreateInput, type LobbyUpdateInput } from "@chill-hub/shared";
import { hasRole, type Actor } from "../../common/auth/actor";
import { cursorArgs, toPage } from "../../common/http/pagination";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../settings/settings.service";
import { isActiveStatus, lobbyInclude, toLobbyView } from "./lobby.presenter";
import {
  checkActiveLobbyLimit,
  checkCapacity,
  checkLobbyRefs,
  checkStartsAt,
  lockLobby,
  lockUser,
  syncFullness,
} from "./lobby-rules";

/** Lobby listings: browse, create, edit, close and delete (LOB-01 to LOB-09, LOB-13). */
@Injectable()
export class LobbiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: LobbiesListQuery, actor: Actor) {
    const where: Prisma.LobbyWhereInput = {
      ...(q.gameId ? { gameId: q.gameId } : {}),
      ...(q.modeId ? { modeId: q.modeId } : {}),
      ...(q.visibility ? { visibility: q.visibility } : {}),
      ...(q.hostId ? { hostId: q.hostId } : {}),
      ...(q.voiceChat !== undefined ? { voiceChat: q.voiceChat } : {}),
      ...(q.roleId ? { neededRoles: { some: { gameRoleId: q.roleId } } } : {}),
    };
    if (q.mine) {
      where.members = { some: { userId: actor.id, leftAt: null } };
      where.status = q.status ?? { in: [...ACTIVE_LOBBY_STATUSES] };
    } else {
      where.status = q.status ?? "open";
    }

    const startsAt: Prisma.DateTimeFilter = {};
    if (q.startsAfter) startsAt.gte = q.startsAfter;
    if (q.startsBefore) startsAt.lte = q.startsBefore;
    if (!q.mine && where.status === "open" && !q.startsAfter) {
      // Hide lobbies past their expiry time until the expiry job (step 3d) marks them expired.
      const hours = await this.settings.get("lobby_expiry_hours");
      startsAt.gte = new Date(Date.now() - hours * 3_600_000);
    }
    if (Object.keys(startsAt).length) where.startsAt = startsAt;

    if (q.rankId) {
      const rank = await this.prisma.gameRank.findUnique({ where: { id: q.rankId } });
      if (!rank) return { items: [], nextCursor: null };
      where.gameId = rank.gameId;
      where.AND = [
        { OR: [{ minRankId: null }, { minRank: { tierOrder: { lte: rank.tierOrder } } }] },
        { OR: [{ maxRankId: null }, { maxRank: { tierOrder: { gte: rank.tierOrder } } }] },
      ];
    }

    const rows = await this.prisma.lobby.findMany({
      where,
      include: lobbyInclude(actor.id),
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit, (row) => toLobbyView(row, actor.id));
  }

  async get(id: string, actor: Actor) {
    const row = await this.prisma.lobby.findUnique({ where: { id }, include: lobbyInclude(actor.id) });
    if (!row) throw new NotFoundException("Lobby not found");
    const members = await this.prisma.lobbyMember.findMany({
      where: { lobbyId: id, leftAt: null },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, joinedAt: true, user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } },
    });
    return {
      ...toLobbyView(row, actor.id),
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.user.profile?.displayName ?? null,
        avatarUrl: m.user.profile?.avatarUrl ?? null,
        isHost: m.userId === row.hostId,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async create(input: LobbyCreateInput, actor: Actor) {
    const game = await this.prisma.game.findFirst({ where: { id: input.gameId, isActive: true } });
    if (!game) throw new NotFoundException("Game not found");
    checkCapacity(input.capacity, game.maxLobbySize);
    checkStartsAt(input.startsAt);
    await checkLobbyRefs(this.prisma, game.id, input);
    const limit = await this.settings.get("max_active_lobbies_per_player");

    const lobbyId = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, actor.id);
      await checkActiveLobbyLimit(tx, actor.id, limit);
      const lobby = await tx.lobby.create({
        data: {
          hostId: actor.id,
          gameId: game.id,
          modeId: input.modeId,
          lobbyCode: input.lobbyCode,
          visibility: input.visibility,
          capacity: input.capacity,
          minRankId: input.minRankId ?? null,
          maxRankId: input.maxRankId ?? null,
          voiceChat: input.voiceChat ?? false,
          startsAt: input.startsAt,
          note: input.note ?? null,
          neededRoles: { create: [...new Set(input.neededRoleIds ?? [])].map((gameRoleId) => ({ gameRoleId })) },
          members: { create: { userId: actor.id } },
        },
      });
      return lobby.id;
    });
    return this.get(lobbyId, actor);
  }

  /** LOB-07: only the host edits. Changing the code notifies every member. */
  async update(id: string, input: LobbyUpdateInput, actor: Actor) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id }, include: { game: true } });
    if (!lobby) throw new NotFoundException("Lobby not found");
    if (lobby.hostId !== actor.id) throw new ForbiddenException("Only the host can edit this lobby");
    if (!isActiveStatus(lobby.status)) throw new ConflictException("This lobby has ended and can't be edited");

    if (input.startsAt) checkStartsAt(input.startsAt);
    await checkLobbyRefs(this.prisma, lobby.gameId, {
      modeId: input.modeId,
      minRankId: input.minRankId !== undefined ? input.minRankId : lobby.minRankId,
      maxRankId: input.maxRankId !== undefined ? input.maxRankId : lobby.maxRankId,
      neededRoleIds: input.neededRoleIds,
    });
    if (input.status === "in_progress" && lobby.status === "in_progress") {
      throw new ConflictException("The lobby is already in progress");
    }

    const codeChanged = input.lobbyCode !== undefined && input.lobbyCode !== lobby.lobbyCode;
    const closing = input.status === "closed";

    await this.prisma.$transaction(async (tx) => {
      await lockLobby(tx, id);
      const memberCount = await tx.lobbyMember.count({ where: { lobbyId: id, leftAt: null } });
      if (input.capacity !== undefined) checkCapacity(input.capacity, lobby.game.maxLobbySize, memberCount);

      if (input.neededRoleIds) {
        await tx.lobbyNeededRole.deleteMany({ where: { lobbyId: id } });
        await tx.lobbyNeededRole.createMany({
          data: [...new Set(input.neededRoleIds)].map((gameRoleId) => ({ lobbyId: id, gameRoleId })),
        });
      }
      await tx.lobby.update({
        where: { id },
        data: {
          ...(input.modeId !== undefined ? { modeId: input.modeId } : {}),
          ...(input.lobbyCode !== undefined ? { lobbyCode: input.lobbyCode } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.minRankId !== undefined ? { minRankId: input.minRankId } : {}),
          ...(input.maxRankId !== undefined ? { maxRankId: input.maxRankId } : {}),
          ...(input.voiceChat !== undefined ? { voiceChat: input.voiceChat } : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(closing ? { closedAt: new Date() } : {}),
        },
      });
      if (input.capacity !== undefined) await syncFullness(tx, id);

      const members = await tx.lobbyMember.findMany({ where: { lobbyId: id, leftAt: null }, select: { userId: true } });
      const others = members.map((m) => m.userId).filter((u) => u !== actor.id);
      if (codeChanged) {
        await tx.chatMessage.create({ data: { lobbyId: id, kind: "system", body: "The host changed the lobby code." } });
        await this.notifications.notify(
          others,
          { type: "lobby_code_changed", title: "Lobby code changed", body: "Open the lobby to see the new code.", data: { lobbyId: id } },
          tx,
        );
      }
      if (closing) {
        // Pending requests can no longer be accepted.
        await tx.lobbyJoinRequest.updateMany({
          where: { lobbyId: id, status: "pending" },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        await tx.chatMessage.create({ data: { lobbyId: id, kind: "system", body: "The host closed the lobby." } });
        // REP-01: everyone still in the lobby is asked to rate their teammates.
        await this.notifications.notify(
          members.map((m) => m.userId),
          { type: "rate_teammates", title: "How was your team?", body: "Rate your teammates from this lobby.", data: { lobbyId: id } },
          tx,
        );
      }
    });
    return this.get(id, actor);
  }

  /** Hard delete. Admins: any lobby. Hosts: only while nobody else has joined (otherwise close it). */
  async remove(id: string, actor: Actor) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id } });
    if (!lobby) throw new NotFoundException("Lobby not found");
    if (!hasRole(actor, "admin")) {
      if (lobby.hostId !== actor.id) throw new ForbiddenException("Only the host can delete this lobby");
      const others = await this.prisma.lobbyMember.count({ where: { lobbyId: id, userId: { not: actor.id } } });
      if (others) throw new ConflictException("Players have already joined. Close the lobby instead of deleting it.");
    }
    await this.prisma.lobby.delete({ where: { id } });
  }
}
