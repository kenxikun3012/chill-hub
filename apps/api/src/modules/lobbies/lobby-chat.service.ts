import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ChatMessagesListQuery } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { cursorArgs, toPage } from "../../common/http/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeBus } from "../realtime/realtime-bus";
import { isActiveStatus } from "./lobby.presenter";

/** Lobby chat (LOB-11): members only, read-only once the lobby has ended. New messages are signalled live; push is opt-in. */
@Injectable()
export class LobbyChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly bus: RealtimeBus,
  ) {}

  /** Newest first; use nextCursor to load older messages. */
  async list(lobbyId: string, q: ChatMessagesListQuery, actor: Actor) {
    await this.requireMember(lobbyId, actor);
    const rows = await this.prisma.chatMessage.findMany({
      where: { lobbyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { sender: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit, (m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt,
      sender: m.sender
        ? { userId: m.sender.id, displayName: m.sender.profile?.displayName ?? null, avatarUrl: m.sender.profile?.avatarUrl ?? null }
        : null,
    }));
  }

  async send(lobbyId: string, body: string, actor: Actor) {
    const lobby = await this.requireMember(lobbyId, actor);
    if (!isActiveStatus(lobby.status)) throw new ConflictException("This lobby has ended; the chat is read-only");
    const m = await this.prisma.chatMessage.create({
      data: { lobbyId, senderId: actor.id, kind: "user", body },
      include: { sender: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
    });
    this.bus.chatMessage(lobbyId);
    const members = await this.prisma.lobbyMember.findMany({ where: { lobbyId, leftAt: null, userId: { not: actor.id } }, select: { userId: true } });
    await this.notifications.notify(members.map((member) => member.userId), {
      type: "chat_message",
      title: "New lobby message",
      body: `${m.sender?.profile?.displayName ?? "A player"}: ${body.slice(0, 120)}`,
      data: { lobbyId },
    });
    return {
      id: m.id,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt,
      sender: { userId: actor.id, displayName: m.sender?.profile?.displayName ?? null, avatarUrl: m.sender?.profile?.avatarUrl ?? null },
    };
  }

  private async requireMember(lobbyId: string, actor: Actor) {
    const lobby = await this.prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) throw new NotFoundException("Lobby not found");
    const member = await this.prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId: actor.id } } });
    if (!member || member.leftAt) throw new ForbiddenException("Only lobby members can use the chat");
    return lobby;
  }
}
