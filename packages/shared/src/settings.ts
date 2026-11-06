import { z } from "zod";

/**
 * Admin-editable settings (ADM-06). Each key has its own value schema.
 * Defaults are seeded by apps/api/prisma/seed.ts.
 */
export const SETTING_SCHEMAS = {
  /** An empty list means any email address can sign up (the college has no email domain). */
  allowed_email_domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "A domain such as yourcollege.edu"),
    )
    .max(10),
  /** The club's join code, needed to sign up. Empty means no code is needed. Never shown to the public. */
  signup_join_code: z.string().trim().max(40),
  lobby_expiry_hours: z.number().int().min(1).max(48),
  max_active_lobbies_per_player: z.number().int().min(1).max(20),
  lobby_chat_retention_days: z.number().int().min(1).max(365),
  lobby_start_reminder_minutes: z.number().int().min(1).max(120),
  rating_edit_window_hours: z.number().int().min(1).max(168),
  no_show_flag_threshold_percent: z.number().int().min(1).max(100),
  id_photo_retention_days: z.number().int().min(1).max(365),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValues = { [K in SettingKey]: z.infer<(typeof SETTING_SCHEMAS)[K]> };
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];
export const settingKeySchema = z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]);

export const SETTING_DEFAULTS: SettingValues = {
  allowed_email_domains: [],
  signup_join_code: "",
  lobby_expiry_hours: 2,
  max_active_lobbies_per_player: 3,
  lobby_chat_retention_days: 7,
  lobby_start_reminder_minutes: 10,
  rating_edit_window_hours: 24,
  no_show_flag_threshold_percent: 20,
  id_photo_retention_days: 30,
};

/**
 * Settings any client may read (e.g. to hint the email domain on the sign-up form). The join code itself is not
 * among them; the API adds a `signup_join_code_required` flag instead.
 */
export const PUBLIC_SETTING_KEYS = ["allowed_email_domains", "max_active_lobbies_per_player"] as const satisfies readonly SettingKey[];

export const settingUpdateSchema = z.strictObject({ value: z.unknown() });
export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;
