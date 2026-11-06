import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  NOTIFICATION_GROUPS,
  type NotificationGroup,
  type NotificationPreferenceUpdateInput,
  type NotificationsListQuery,
  type NotificationType,
  type PushTokenCreateInput,
} from "@chill-hub/shared";
import { cursorArgs, toPage } from "../../common/http/pagination";
import type { Actor } from "../../common/auth/actor";
import { PrismaService, type Db } from "../../prisma/prisma.service";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { channelsFor, NOTIFICATION_TYPE_GROUP } from "./notification-groups";

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  /**
   * Stores a notification for each user with any channel on for this group; delivery follows shortly after.
   * Pass a transaction client to include it in a transaction. Returns how many went to an inbox.
   */
  async notify(userIds: string[], n: NewNotification, db: Db = this.prisma): Promise<number> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return 0;
    const group = NOTIFICATION_TYPE_GROUP[n.type];
    const saved = await db.notificationPreference.findMany({ where: { userId: { in: unique }, group } });
    const byUser = new Map(saved.map((p) => [p.userId, p]));
    const rows = unique.flatMap((userId) => {
      const channels = channelsFor(group, byUser.get(userId));
      if (!channels.inApp && !channels.push && !channels.email) return [];
      return [{ userId, type: n.type, title: n.title, body: n.body, data: n.data ?? {}, inbox: channels.inApp }];
    });
    if (!rows.length) return 0;
    await db.notification.createMany({ data: rows });
    this.delivery.schedule();
    return rows.filter((r) => r.inbox).length;
  }

  // ---------- inbox (NOT-04) ----------

  async list(actor: Actor, q: NotificationsListQuery) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.id, inbox: true, ...(q.unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit);
  }

  async unreadCount(actor: Actor) {
    return { unread: await this.prisma.notification.count({ where: { userId: actor.id, inbox: true, readAt: null } }) };
  }

  async setRead(actor: Actor, id: string, read: boolean) {
    await this.findOwn(actor, id);
    return this.prisma.notification.update({ where: { id }, data: { readAt: read ? new Date() : null } });
  }

  async readAll(actor: Actor) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async remove(actor: Actor, id: string) {
    await this.findOwn(actor, id);
    await this.prisma.notification.delete({ where: { id } });
  }

  private async findOwn(actor: Actor, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId: actor.id, inbox: true } });
    if (!n) throw new NotFoundException("Notification not found");
    return n;
  }

  // ---------- preferences (NOT-03) ----------

  async preferences(actor: Actor) {
    const saved = await this.prisma.notificationPreference.findMany({ where: { userId: actor.id } });
    const byGroup = new Map(saved.map((p) => [p.group, p]));
    return NOTIFICATION_GROUPS.map((group) => {
      const p = byGroup.get(group);
      const values = channelsFor(group, p);
      return { group, push: values.push, email: values.email, inApp: values.inApp, locked: group === "account" };
    });
  }

  async updatePreference(actor: Actor, group: NotificationGroup, input: NotificationPreferenceUpdateInput) {
    if (group === "account") throw new BadRequestException("Account notifications can't be turned off");
    const saved = await this.prisma.notificationPreference.upsert({
      where: { userId_group: { userId: actor.id, group } },
      update: input,
      create: { userId: actor.id, group, ...input },
    });
    return { group: saved.group, ...channelsFor(group, saved), locked: false };
  }

  // ---------- push tokens ----------

  /** Registers (or moves) an Expo push token to the current user. */
  registerPushToken(actor: Actor, input: PushTokenCreateInput) {
    return this.prisma.pushToken.upsert({
      where: { expoToken: input.expoToken },
      update: { userId: actor.id, platform: input.platform, lastUsedAt: new Date() },
      create: { userId: actor.id, expoToken: input.expoToken, platform: input.platform },
    });
  }

  async removePushToken(actor: Actor, expoToken: string) {
    const result = await this.prisma.pushToken.deleteMany({ where: { userId: actor.id, expoToken } });
    if (!result.count) throw new NotFoundException("Push token not found");
  }
}
