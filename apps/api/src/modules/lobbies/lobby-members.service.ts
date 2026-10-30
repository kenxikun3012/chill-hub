import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JoinRequestsListQuery, JoinRequestUpdateInput } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../settings/settings.service";
import { IN_GAME_ACCOUNT_INCLUDE, toInGameAccountView } from "../profiles/profiles.service";
import { RatingsService } from "../ratings/ratings.service";
import { isActiveStatus } from "./lobby.presenter";
import { checkActiveLobbyLimit, displayNameOf, lockLobby, lockUser, syncFullness } from "./lobby-rules";
import { LobbiesService } from "./lobbies.service";

/** Joining, leaving and join requests (LOB-04, LOB-05, LOB-10). */
@Injectable()
export class LobbyMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly lobbies: LobbiesService,
    private readonly ratings: RatingsService,
  ) {}

  async members(lobbyId: string) {
    const lobby = await this.findLobby(lobbyId);
    const rows = await this.prisma.lobbyMember.findMany({
      where: { lobbyId, leftAt: null },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, joinedAt: true, user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } },
    });
    return rows.map((m) => ({
      userId: m.userId,
      displayName: m.user.profile?.displayName ?? null,
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      isHost: m.userId === lobby.hostId,
      joinedAt: m.joinedAt,
    }));
  }

  /** LOB-04: take a slot in a public lobby. */
  async join(lobbyId: string, actor: Actor) {
    const limit = await this.settings.get("max_active_lobbies_per_player");
    await this.prisma.$transaction(async (tx) => {
      await lockLobby(tx, lobbyId);
      const lobby = await tx.lobby.findUnique({ where: { id: lobbyId } });
      if (!lobby) throw new NotFoundException("Lobby not found");
      if (lobby.visibility !== "public") throw new ForbiddenException("This lobby is private. Send a join request instead.");
      if (lobby.status === "full") throw new ConflictException("This lobby is full");
      if (lobby.status !== "open") throw new ConflictException("This lobby isn't taking players any more");
      const existing = await tx.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: actor.id } } });
      if (existing && !existing.leftAt) throw new ConflictException("You're already in this lobby");

      await lockUser(tx, actor.id);
      await checkActiveLobbyLimit(tx, actor.id, limit);
      await tx.lobbyMember.upsert({
        where: { lobbyId_userId: { lobbyId, userId: actor.id } },
        update: { leftAt: null, joinedAt: new Date() },
        create: { lobbyId, userId: actor.id },
      });
      await syncFullness(tx, lobbyId);
      const name = await displayNameOf(tx, actor.id);
      await tx.chatMessage.create({ data: { lobbyId, kind: "system", body: `${name} joined the lobby` } });
      await this.notifications.notify(
        [lobby.hostId],
        { type: "lobby_member_joined", title: "A player joined your lobby", body: `${name} took a slot.`, data: { lobbyId } },
        tx,
      );
    });
    return this.lobbies.get(lobbyId, actor);
  }

  /** Leave (yourself) or remove a member (host). The host can't leave: they close the lobby instead. */
  async removeMember(lobbyId: string, userId: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      await lockLobby(tx, lobbyId);
      const lobby = await tx.lobby.findUnique({ where: { id: lobbyId } });
      if (!lobby) throw new NotFoundException("Lobby not found");
      const self = userId === actor.id;
      if (!self && lobby.hostId !== actor.id) throw new ForbiddenException("Only the host can remove players");
      if (userId === lobby.hostId) throw new ConflictException("The host can't leave. Close the lobby instead.");
      if (!isActiveStatus(lobby.status)) throw new ConflictException("This lobby has already ended");
      const member = await tx.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } });
      if (!member || member.leftAt) throw new NotFoundException("That player isn't in this lobby");

      await tx.lobbyMember.update({ where: { lobbyId_userId: { lobbyId, userId } }, data: { leftAt: new Date() } });
      await syncFullness(tx, lobbyId);
      const name = await displayNameOf(tx, userId);
      await tx.chatMessage.create({
        data: { lobbyId, kind: "system", body: self ? `${name} left the lobby` : `${name} was removed by the host` },
      });
      if (self) {
        await this.notifications.notify(
          [lobby.hostId],
          { type: "lobby_member_left", title: "A player left your lobby", body: `${name} left.`, data: { lobbyId } },
          tx,
        );
      }
    });
  }

  // ---------- join requests (private lobbies) ----------

  /** LOB-05: ask to join a private lobby. Asking again after a decline reuses the same request. */
  async requestToJoin(lobbyId: string, actor: Actor) {
    const lobby = await this.findLobby(lobbyId);
    if (lobby.visibility !== "private") throw new ConflictException("This lobby is public. Take a slot instead.");
    if (lobby.status !== "open") throw new ConflictException("This lobby isn't taking requests right now");
    if (lobby.hostId === actor.id) throw new ConflictException("You're the host of this lobby");
    const member = await this.prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: actor.id } } });
    if (member && !member.leftAt) throw new ConflictException("You're already in this lobby");
    const existing = await this.prisma.lobbyJoinRequest.findUnique({ where: { lobbyId_userId: { lobbyId, userId: actor.id } } });
    if (existing?.status === "pending") throw new ConflictException("You've already asked to join this lobby");

    const request = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.lobbyJoinRequest.upsert({
        where: { lobbyId_userId: { lobbyId, userId: actor.id } },
        update: { status: "pending", createdAt: new Date(), respondedAt: null },
        create: { lobbyId, userId: actor.id },
      });
      const name = await displayNameOf(tx, actor.id);
      await this.notifications.notify(
        [lobby.hostId],
        { type: "join_request_received", title: "New join request", body: `${name} wants to join your lobby.`, data: { lobbyId, requestId: saved.id } },
        tx,
      );
      return saved;
    });
    return { id: request.id, lobbyId, status: request.status, createdAt: request.createdAt };
  }

  /** The host sees requests with each player's rank, roles and reputation for the lobby's game. */
  async listRequests(lobbyId: string, q: JoinRequestsListQuery, actor: Actor) {
    const lobby = await this.findLobby(lobbyId);
    if (lobby.hostId !== actor.id) throw new ForbiddenException("Only the host can see join requests");
    const requests = await this.prisma.lobbyJoinRequest.findMany({
      where: { lobbyId, status: q.status },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
            inGameAccounts: { where: { gameId: lobby.gameId }, include: IN_GAME_ACCOUNT_INCLUDE },
          },
        },
      },
    });
    const reputations = await this.ratings.reputationFor(requests.map((r) => r.userId));
    return requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      player: {
        userId: r.user.id,
        displayName: r.user.profile?.displayName ?? null,
        avatarUrl: r.user.profile?.avatarUrl ?? null,
        inGameAccount: r.user.inGameAccounts[0] ? toInGameAccountView(r.user.inGameAccounts[0]) : null,
        reputation: reputations.get(r.userId),
      },
    }));
  }

  /** Host accepts or declines; the requester can cancel their own pending request. */
  async updateRequest(lobbyId: string, requestId: string, input: JoinRequestUpdateInput, actor: Actor) {
    const limit = await this.settings.get("max_active_lobbies_per_player");
    await this.prisma.$transaction(async (tx) => {
      await lockLobby(tx, lobbyId);
      const request = await tx.lobbyJoinRequest.findFirst({ where: { id: requestId, lobbyId }, include: { lobby: true } });
      if (!request) throw new NotFoundException("Join request not found");
      if (request.status !== "pending") throw new ConflictException("This request has already been answered");
      const { lobby } = request;

      if (input.status === "cancelled") {
        if (request.userId !== actor.id) throw new ForbiddenException("Only the player who asked can cancel");
      } else if (lobby.hostId !== actor.id) {
        throw new ForbiddenException("Only the host can answer join requests");
      }

      if (input.status === "accepted") {
        if (lobby.status === "full") throw new ConflictException("The lobby is full");
        if (lobby.status !== "open") throw new ConflictException("This lobby isn't taking players any more");
        await lockUser(tx, request.userId);
        await checkActiveLobbyLimit(tx, request.userId, limit).catch(() => {
          throw new ConflictException("This player is already in the maximum number of active lobbies");
        });
        await tx.lobbyMember.upsert({
          where: { lobbyId_userId: { lobbyId, userId: request.userId } },
          update: { leftAt: null, joinedAt: new Date() },
          create: { lobbyId, userId: request.userId },
        });
        await syncFullness(tx, lobbyId);
        const name = await displayNameOf(tx, request.userId);
        await tx.chatMessage.create({ data: { lobbyId, kind: "system", body: `${name} joined the lobby` } });
      }

      await tx.lobbyJoinRequest.update({ where: { id: requestId }, data: { status: input.status, respondedAt: new Date() } });

      if (input.status === "accepted" || input.status === "declined") {
        const accepted = input.status === "accepted";
        await this.notifications.notify(
          [request.userId],
          {
            type: accepted ? "join_request_accepted" : "join_request_declined",
            title: accepted ? "You're in!" : "Join request declined",
            body: accepted ? "The host accepted you. Open the lobby to see the code." : "The host declined your request.",
            data: { lobbyId },
          },
          tx,
        );
      }
    });
    const updated = await this.prisma.lobbyJoinRequest.findUniqueOrThrow({ where: { id: requestId } });
    return { id: updated.id, lobbyId, status: updated.status, createdAt: updated.createdAt, respondedAt: updated.respondedAt };
  }

  private async findLobby(id: string) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id } });
    if (!lobby) throw new NotFoundException("Lobby not found");
    return lobby;
  }
}
