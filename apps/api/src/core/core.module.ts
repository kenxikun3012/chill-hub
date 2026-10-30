import { Global, Module } from "@nestjs/common";
import { ENV, loadEnv, type Env } from "../config/env";
import { ConsoleMailer, Mailer, ResendMailer } from "../modules/auth/mailer";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../modules/settings/settings.service";
import { NotificationsService } from "../modules/notifications/notifications.service";

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
    PrismaService,
    SettingsService,
    NotificationsService,
  ],
  exports: [ENV, Mailer, PrismaService, SettingsService, NotificationsService],
})
export class CoreModule {}
