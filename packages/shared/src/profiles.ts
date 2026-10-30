import { z } from "zod";
import { idSchema, optionalText } from "./common.js";

export const displayNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,24}$/, "3–24 characters: letters, numbers, _ . -");

export const profileUpsertSchema = z.strictObject({
  displayName: displayNameSchema,
  avatarUrl: z.url().max(500).nullable().optional(),
  bio: optionalText(200),
  year: z.number().int().min(1).max(8).nullable().optional(),
  department: optionalText(80),
});

export const inGameAccountCreateSchema = z.strictObject({
  gameId: idSchema,
  inGameName: z.string().trim().min(1).max(64),
  rankId: idSchema.nullable().optional(),
  preferredRoleIds: z.array(idSchema).max(6).default([]),
});

export const inGameAccountUpdateSchema = z.strictObject({
  inGameName: z.string().trim().min(1).max(64).optional(),
  rankId: idSchema.nullable().optional(),
  preferredRoleIds: z.array(idSchema).max(6).optional(),
});

export type ProfileUpsertInput = z.infer<typeof profileUpsertSchema>;
export type InGameAccountCreateInput = z.infer<typeof inGameAccountCreateSchema>;
export type InGameAccountUpdateInput = z.infer<typeof inGameAccountUpdateSchema>;
