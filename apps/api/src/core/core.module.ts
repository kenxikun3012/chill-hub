import { Global, Module } from "@nestjs/common";
import { ENV, loadEnv, type Env } from "../config/env";
import { ConsoleMailer, Mailer, ResendMailer } from "../modules/auth/mailer";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../modules/settings/settings.service";
import { NotificationDeliveryService } from "../modules/notifications/notification-delivery.service";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { ExpoPushSender, PushSender } from "../modules/notifications/push-sender";
import { RealtimeBus } from "../modules/realtime/realtime-bus";

/** Services used by most feature modules: environment, database, settings and notifications. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    {
      provide: Mailer,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.RESEND_API_KEY && env.MAIL_FROM ? new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM) : new ConsoleMailer(),
    },
    { provide: PushSender, inject: [ENV], useFactory: (env: Env) => new ExpoPushSender(env.EXPO_ACCESS_TOKEN) },
    RealtimeBus,
    PrismaService,
    SettingsService,
    NotificationDeliveryService,
    NotificationsService,
  ],
  exports: [ENV, Mailer, RealtimeBus, PrismaService, SettingsService, NotificationDeliveryService, NotificationsService],
})
export class CoreModule {}
