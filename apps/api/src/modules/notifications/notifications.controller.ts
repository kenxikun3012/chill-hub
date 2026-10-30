import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  idSchema,
  notificationGroupSchema,
  notificationPreferenceUpdateSchema,
  notificationsListQuerySchema,
  notificationUpdateSchema,
  pushTokenCreateSchema,
  type NotificationGroup,
  type NotificationPreferenceUpdateInput,
  type NotificationsListQuery,
  type NotificationUpdateInput,
  type PushTokenCreateInput,
} from "@chill-hub/shared";
import { z } from "zod";
import type { Actor } from "../../common/auth/actor";
import { AllowPending, CurrentActor } from "../../common/auth/decorators";
import { NotificationsService } from "./notifications.service";

/** The current user's inbox, notification preferences and push tokens. Pending users included (approval news). */
@ApiTags("Notifications")
@AllowPending()
@Controller("me")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("notifications")
  list(@CurrentActor() actor: Actor, @Query({ schema: notificationsListQuerySchema }) q: NotificationsListQuery) {
    return this.notifications.list(actor, q);
  }

  @Get("notifications/unread-count")
  unreadCount(@CurrentActor() actor: Actor) {
    return this.notifications.unreadCount(actor);
  }

  @Post("notifications/read-all")
  @HttpCode(200)
  readAll(@CurrentActor() actor: Actor) {
    return this.notifications.readAll(actor);
  }

  @Patch("notifications/:id")
  update(
    @CurrentActor() actor: Actor,
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: notificationUpdateSchema }) body: NotificationUpdateInput,
  ) {
    return this.notifications.setRead(actor, id, body.read);
  }

  @Delete("notifications/:id")
  @HttpCode(204)
  remove(@CurrentActor() actor: Actor, @Param("id", { schema: idSchema }) id: string) {
    return this.notifications.remove(actor, id);
  }

  @Get("notification-preferences")
  preferences(@CurrentActor() actor: Actor) {
    return this.notifications.preferences(actor);
  }

  @Put("notification-preferences/:group")
  updatePreference(
    @CurrentActor() actor: Actor,
    @Param("group", { schema: notificationGroupSchema }) group: NotificationGroup,
    @Body({ schema: notificationPreferenceUpdateSchema }) body: NotificationPreferenceUpdateInput,
  ) {
    return this.notifications.updatePreference(actor, group, body);
  }

  @Post("push-tokens")
  registerPushToken(@CurrentActor() actor: Actor, @Body({ schema: pushTokenCreateSchema }) body: PushTokenCreateInput) {
    return this.notifications.registerPushToken(actor, body);
  }

  @Delete("push-tokens/:token")
  @HttpCode(204)
  removePushToken(@CurrentActor() actor: Actor, @Param("token", { schema: z.string().min(1).max(200) }) token: string) {
    return this.notifications.removePushToken(actor, token);
  }
}
