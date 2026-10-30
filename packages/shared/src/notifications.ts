import { z } from "zod";
import { paginationQuerySchema } from "./common.js";
import { devicePlatformSchema } from "./enums.js";

export const notificationsListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.stringbool().optional(),
});

export const notificationUpdateSchema = z.strictObject({ read: z.boolean() });

export const notificationPreferenceUpdateSchema = z.strictObject({
  push: z.boolean(),
  email: z.boolean(),
  inApp: z.boolean(),
});

export const pushTokenCreateSchema = z.strictObject({
  expoToken: z
    .string()
    .trim()
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Must be an Expo push token"),
  platform: devicePlatformSchema,
});

export type NotificationsListQuery = z.infer<typeof notificationsListQuerySchema>;
export type NotificationUpdateInput = z.infer<typeof notificationUpdateSchema>;
export type NotificationPreferenceUpdateInput = z.infer<typeof notificationPreferenceUpdateSchema>;
export type PushTokenCreateInput = z.infer<typeof pushTokenCreateSchema>;
