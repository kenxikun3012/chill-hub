import { Global, Module } from "@nestjs/common";
import { ENV, loadEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../modules/settings/settings.service";
import { NotificationsService } from "../modules/notifications/notifications.service";

/** Services used by most feature modules: environment, database, settings and notifications. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, PrismaService, SettingsService, NotificationsService],
  exports: [ENV, PrismaService, SettingsService, NotificationsService],
})
export class CoreModule {}
