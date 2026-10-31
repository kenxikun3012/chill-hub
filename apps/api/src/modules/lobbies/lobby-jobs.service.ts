import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { ACTIVE_LOBBY_STATUSES } from "@chill-hub/shared";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationDeliveryService } from "../notifications/notification-delivery.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeBus } from "../realtime/realtime-bus";
import { SettingsService } from "../settings/settings.service";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Catches anything missed, such as a changed setting, without keeping the database awake. */
const MAX_SLEEP_MS = 6 * HOUR;
const MIN_SLEEP_MS = 1000;

/**
 * Lobby expiry (LOB-09), start reminders (LOB-12) and chat clean-up (LOB-11).
 * Instead of checking every minute, which would keep a Neon database awake and use up its free hours,
 * this works out when the next job is due and sleeps until then. Changing a lobby recalculates it.
 */
@Injectable()
export class LobbyJobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LobbyJobsService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly delivery: NotificationDeliveryService,
    private readonly bus: RealtimeBus,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.JOBS_ENABLED) void this.tick();
  }

  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** A lobby changed, so the next job may be sooner. */
  reschedule() {
    if (this.env.JOBS_ENABLED) void this.planNext();
  }

  private async tick() {
    try {
      await this.runAll();
    } catch (err) {
      this.logger.error(`Lobby jobs failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await this.planNext();
  }

  private async planNext() {
    if (this.stopped) return;
    let wait = MAX_SLEEP_MS;
    try {
      wait = Math.max(MIN_SLEEP_MS, Math.min(MAX_SLEEP_MS, (await this.nextDue()) - Date.now()));
    } catch (err) {
      this.logger.error(`Couldn't plan lobby jobs: ${err instanceof Error ? err.message : String(err)}`);
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), wait);
    this.timer.unref();
  }

  async runAll() {
    await this.expireLobbies();
    await this.sendReminders();
    await this.cleanChat();
    await this.delivery.flush(); // anything left by a crash
  }

  private async lobbyTimes() {
    return {
      expiryMs: (await this.settings.get("lobby_expiry_hours")) * HOUR,
      reminderMs: (await this.settings.get("lobby_start_reminder_minutes")) * MINUTE,
      chatMs: (await this.settings.get("lobby_chat_retention_days")) * DAY,
    };
  }

  /** Lobbies started by "now" don't get a reminder: only those scheduled further ahead than the reminder time. */
  private remindable(lobby: { startsAt: Date; createdAt: Date }, reminderMs: number) {
    return lobby.startsAt.getTime() - lobby.createdAt.getTime() > reminderMs;
  }

  private async nextDue() {
    const { expiryMs, reminderMs, chatMs } = await this.lobbyTimes();
    const now = new Date();
    const due: number[] = [Date.now() + MAX_SLEEP_MS];

    const oldest = await this.prisma.lobby.findFirst({
      where: { status: { in: [...ACTIVE_LOBBY_STATUSES] } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    });
    if (oldest) due.push(oldest.startsAt.getTime() + expiryMs);

    const upcoming = await this.prisma.lobby.findMany({
      where: { status: { in: [...ACTIVE_LOBBY_STATUSES] }, reminderSentAt: null, startsAt: { gt: now } },
      select: { startsAt: true, createdAt: true },
    });
    for (const lobby of upcoming) {
      if (this.remindable(lobby, reminderMs)) due.push(lobby.startsAt.getTime() - reminderMs);
    }

    const ended = await this.prisma.lobby.findFirst({
      where: { status: { in: ["closed", "expired"] }, closedAt: { not: null }, messages: { some: {} } },
      orderBy: { closedAt: "asc" },
      select: { closedAt: true },
    });
    if (ended?.closedAt) due.push(ended.closedAt.getTime() + chatMs);

    return Math.min(...due);
  }

  private async expireLobbies() {
    const { expiryMs } = await this.lobbyTimes();
    const lobbies = await this.prisma.lobby.findMany({
      where: { status: { in: [...ACTIVE_LOBBY_STATUSES] }, startsAt: { lt: new Date(Date.now() - expiryMs) } },
      select: { id: true },
    });
    for (const { id } of lobbies) {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const claimed = await tx.lobby.updateMany({
          where: { id, status: { in: [...ACTIVE_LOBBY_STATUSES] } },
          data: { status: "expired", closedAt: now },
        });
        if (!claimed.count) return;
        await tx.lobbyJoinRequest.updateMany({ where: { lobbyId: id, status: "pending" }, data: { status: "cancelled", respondedAt: now } });
        await tx.chatMessage.create({ data: { lobbyId: id, kind: "system", body: "This lobby has expired." } });
        const members = await tx.lobbyMember.findMany({ where: { lobbyId: id, leftAt: null }, select: { userId: true } });
        await this.notifications.notify(
          members.map((m) => m.userId),
          { type: "rate_teammates", title: "How was your team?", body: "Rate your teammates from this lobby.", data: { lobbyId: id } },
          tx,
        );
      });
      this.bus.lobbyChanged(id);
    }
  }

  private async sendReminders() {
    const { reminderMs } = await this.lobbyTimes();
    const now = Date.now();
    const lobbies = await this.prisma.lobby.findMany({
      where: {
        status: { in: [...ACTIVE_LOBBY_STATUSES] },
        reminderSentAt: null,
        startsAt: { gt: new Date(now), lte: new Date(now + reminderMs) },
      },
      include: { game: { select: { name: true } }, members: { where: { leftAt: null }, select: { userId: true } } },
    });
    for (const lobby of lobbies) {
      if (!this.remindable(lobby, reminderMs)) continue;
      const minutes = Math.max(1, Math.ceil((lobby.startsAt.getTime() - now) / MINUTE));
      await this.prisma.$transaction(async (tx) => {
        await tx.lobby.update({ where: { id: lobby.id }, data: { reminderSentAt: new Date() } });
        await this.notifications.notify(
          lobby.members.map((m) => m.userId),
          { type: "lobby_starting_soon", title: "Your lobby starts soon", body: `${lobby.game.name} starts in ${minutes} min.`, data: { lobbyId: lobby.id } },
          tx,
        );
      });
    }
  }

  private async cleanChat() {
    const { chatMs } = await this.lobbyTimes();
    await this.prisma.chatMessage.deleteMany({
      where: { lobby: { status: { in: ["closed", "expired"] }, closedAt: { lt: new Date(Date.now() - chatMs) } } },
    });
  }
}
