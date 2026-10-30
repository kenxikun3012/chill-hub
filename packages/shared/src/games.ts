import { z } from "zod";

export const GAME_PLATFORMS = ["pc", "mobile", "console"] as const;

const gameFields = {
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(1).max(60),
  iconUrl: z.url().max(500).nullable().optional(),
  platforms: z.array(z.enum(GAME_PLATFORMS)).min(1).max(3),
  teamSize: z.number().int().min(1).max(20),
  maxLobbySize: z.number().int().min(2).max(100),
  inGameIdLabel: z.string().trim().min(1).max(60),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
};

export const gameCreateSchema = z
  .strictObject(gameFields)
  .refine((g) => g.maxLobbySize >= g.teamSize, {
    message: "maxLobbySize must be at least teamSize",
    path: ["maxLobbySize"],
  });
export const gameUpdateSchema = z.strictObject(gameFields).partial();
export const gamesListQuerySchema = z.object({
  includeInactive: z.stringbool().optional(),
});

export const gameRankCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  tierOrder: z.number().int().min(1).max(100),
});
export const gameRankUpdateSchema = gameRankCreateSchema.partial();
export const gameRoleCreateSchema = z.strictObject({ name: z.string().trim().min(1).max(40) });
export const gameRoleUpdateSchema = gameRoleCreateSchema;
export const gameModeCreateSchema = z.strictObject({ name: z.string().trim().min(1).max(40) });
export const gameModeUpdateSchema = gameModeCreateSchema;

export type GameCreateInput = z.infer<typeof gameCreateSchema>;
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;
export type GamesListQuery = z.infer<typeof gamesListQuerySchema>;
export type GameRankCreateInput = z.infer<typeof gameRankCreateSchema>;
export type GameRankUpdateInput = z.infer<typeof gameRankUpdateSchema>;
export type GameRoleInput = z.infer<typeof gameRoleCreateSchema>;
export type GameModeInput = z.infer<typeof gameModeCreateSchema>;
