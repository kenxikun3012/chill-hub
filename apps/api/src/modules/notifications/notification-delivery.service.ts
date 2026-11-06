import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { NotificationGroup, NotificationType } from "@chill-hub/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { Mailer } from "../auth/mailer";
import { RealtimeBus } from "../realtime/realtime-bus";
import { channelsFor, NOTIFICATION_TYPE_GROUP } from "./notification-groups";
import { PushSender, type PushMessage } from "./push-sender";

/** First try soon after the notification; the second catches a transaction that took longer to commit. */
const DELIVERY_DELAYS_MS = [400, 3000];
const BATCH_SIZE = 200;

/**
 * Sends stored notifications by push, email and live signal (NOT-01). notify() usually runs inside a
 * transaction, so delivery happens afterwards, from rows marked undelivered. A row rolled back never goes out,
 * and rows left by a crash go out at the next run. Each is attempted once: a duplicate alert is worse than a missed one.
 */
@Injectable()
export class NotificationDeliveryService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly timers = new Set<NodeJS.Timeout>();
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly push: PushSender,
    private readonly bus: RealtimeBus,
  ) {}

  onModuleDestroy() {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  /** Called when notifications have just been stored. */
  schedule() {
    if (this.timers.size) return;
    for (const delay of DELIVERY_DELAYS_MS) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.flush().catch((err: unknown) => {
          // Rows left by a shutdown go out at the next start.
          if (!this.stopped) this.logger.error(`Delivery failed: ${String(err)}`);
        });
      }, delay);
      timer.unref();
      this.timers.add(timer);
    }
  }

  /** Delivers everything waiting. Runs one at a time. */
  async flush(): Promise<void> {
    while (this.running) await this.running;
    this.running = this.deliverAll().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async deliverAll() {
    for (;;) {
      const rows = await this.prisma.notification.findMany({
        where: { deliveredAt: null },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        include: { user: { select: { email: true, deletedAt: true, pushTokens: { select: { expoToken: true } }, notificationPreferences: true } } },
      });
      if (!rows.length) return;
      await this.prisma.notification.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { deliveredAt: new Date() } });

      const messages: PushMessage[] = [];
      for (const row of rows) {
        if (row.user.deletedAt) continue;
        const group: NotificationGroup = NOTIFICATION_TYPE_GROUP[row.type as NotificationType];
        const channels = channelsFor(group, row.user.notificationPreferences.find((p) => p.group === group));
        if (row.inbox) this.bus.notificationsChanged(row.userId);
        if (channels.push) {
          for (const { expoToken } of row.user.pushTokens) {
            messages.push({ to: expoToken, title: row.title, body: row.body, data: { ...(row.data as object | null), notificationId: row.id } });
          }
        }
        // Approval decisions already have their own, fuller email.
        if (channels.email && group !== "account") {
          this.mailer.send({ to: row.user.email, subject: row.title, text: row.body }).catch((err: unknown) => this.logger.error(`Email failed: ${String(err)}`));
        }
      }
      await this.sendPush(messages);
      if (rows.length < BATCH_SIZE) return;
    }
  }

  private async sendPush(messages: PushMessage[]) {
    if (!messages.length) return;
    try {
      const invalid = await this.push.send(messages);
      if (invalid.length) await this.prisma.pushToken.deleteMany({ where: { expoToken: { in: invalid } } });
    } catch (err) {
      this.logger.error(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
