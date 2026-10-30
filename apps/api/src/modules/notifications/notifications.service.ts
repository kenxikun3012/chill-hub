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

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

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

/** Defaults when a user has no saved preference for a group. Account notifications can't be turned off. */
export const PREFERENCE_DEFAULTS: Record<NotificationGroup, { push: boolean; email: boolean; inApp: boolean }> = {
  account: { push: true, email: true, inApp: true },
  lobbies: { push: true, email: false, inApp: true },
  lobby_chat: { push: false, email: false, inApp: true },
  knowledge: { push: true, email: false, inApp: true },
  news: { push: false, email: false, inApp: true },
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores an in-app notification for each user who hasn't turned in-app off for this group.
   * Push and email delivery are added in step 3d. Pass a transaction client to include it in a transaction.
   */
  async notify(userIds: string[], n: NewNotification, db: Db = this.prisma): Promise<number> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return 0;
    const group = NOTIFICATION_TYPE_GROUP[n.type];
    let recipients = unique;
    if (group !== "account") {
      const optedOut = await db.notificationPreference.findMany({
        where: { userId: { in: unique }, group, inApp: false },
        select: { userId: true },
      });
      const skip = new Set(optedOut.map((p) => p.userId));
      if (!PREFERENCE_DEFAULTS[group].inApp) {
        const optedIn = await db.notificationPreference.findMany({
          where: { userId: { in: unique }, group, inApp: true },
          select: { userId: true },
        });
        const keep = new Set(optedIn.map((p) => p.userId));
        recipients = unique.filter((u) => keep.has(u));
      } else {
        recipients = unique.filter((u) => !skip.has(u));
      }
    }
    if (!recipients.length) return 0;
    const result = await db.notification.createMany({
      data: recipients.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, data: n.data ?? {} })),
    });
    return result.count;
  }

  // ---------- inbox (NOT-04) ----------

  async list(actor: Actor, q: NotificationsListQuery) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.id, ...(q.unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit);
  }

  async unreadCount(actor: Actor) {
    return { unread: await this.prisma.notification.count({ where: { userId: actor.id, readAt: null } }) };
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
    const n = await this.prisma.notification.findFirst({ where: { id, userId: actor.id } });
    if (!n) throw new NotFoundException("Notification not found");
    return n;
  }

  // ---------- preferences (NOT-03) ----------

  async preferences(actor: Actor) {
    const saved = await this.prisma.notificationPreference.findMany({ where: { userId: actor.id } });
    const byGroup = new Map(saved.map((p) => [p.group, p]));
    return NOTIFICATION_GROUPS.map((group) => {
      const p = byGroup.get(group);
      const values = group === "account" ? PREFERENCE_DEFAULTS.account : p ?? PREFERENCE_DEFAULTS[group];
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
    return { group: saved.group, push: saved.push, email: saved.email, inApp: saved.inApp, locked: false };
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
