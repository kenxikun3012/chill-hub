import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SETTING_DEFAULTS, type RoleName, type UserStatus } from "@chill-hub/shared";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { DEV_USER_HEADER } from "../src/common/auth/auth.guard";
import { ENV, loadEnv } from "../src/config/env";
import { Mailer, type Mail } from "../src/modules/auth/mailer";
import { PrismaService } from "../src/prisma/prisma.service";
import { SettingsService } from "../src/modules/settings/settings.service";
import { testDatabaseEnv } from "./test-env";

export const API = "/api/v1";
export const DOMAIN = SETTING_DEFAULTS.allowed_email_domains[0]!;

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  mail: MemoryMailer;
}

/** Keeps emails so tests can read the codes. */
export class MemoryMailer extends Mailer {
  sent: Mail[] = [];

  async send(mail: Mail) {
    this.sent.push(mail);
  }

  /** The newest code sent to this address. */
  lastCode(to: string) {
    const mail = this.sent.filter((m) => m.to === to).at(-1);
    return mail?.text.match(/\b\d{6}\b/)?.[0];
  }
}

/** Boots the real AppModule against the test database, with dev auth on. */
export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestContext> {
  const { url } = testDatabaseEnv();
  const env = loadEnv({ ...process.env, NODE_ENV: "test", DATABASE_URL: url, DEV_AUTH: "true", AUTH_RATE_LIMIT: "false", ...overrides });
  const mail = new MemoryMailer();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(env)
    .overrideProvider(Mailer)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ["error"] });
  configureApp(app, env);
  await app.init();
  return { app, prisma: app.get(PrismaService), http: () => request(app.getHttpServer()), mail };
}

/**
 * Deletes everything except the games catalogue, then restores default settings.
 * TRUNCATE users CASCADE also empties every table that references users.
 */
export async function resetDb(ctx: TestContext) {
  await ctx.prisma.$executeRawUnsafe(
    "TRUNCATE TABLE users, lobbies, notifications, verifications, settings RESTART IDENTITY CASCADE",
  );
  await ctx.prisma.setting.createMany({
    data: Object.entries(SETTING_DEFAULTS).map(([key, value]) => ({ key, value: value as object })),
  });
  ctx.app.get(SettingsService).clearCache();
}

let counter = 0;

/** Creates a user directly in the database (sign-up itself arrives in step 3a). */
export async function makeUser(
  ctx: TestContext,
  opts: { status?: UserStatus; roles?: RoleName[]; displayName?: string | null; suspendedUntil?: Date } = {},
) {
  counter += 1;
  const n = `${Date.now().toString(36)}${counter}`;
  const status = opts.status ?? "approved";
  const roles = opts.roles ?? (status === "approved" ? ["player"] : []);
  const displayName = opts.displayName === undefined ? `player_${n}` : opts.displayName;
  const user = await ctx.prisma.user.create({
    data: {
      name: `Test User ${n}`,
      email: `user${n}@${DOMAIN}`,
      studentIdNumber: `S-${n}`,
      status,
      suspendedUntil: opts.suspendedUntil ?? null,
      roles: roles.length ? { create: roles.map((role) => ({ role })) } : undefined,
      profile: displayName ? { create: { displayName } } : undefined,
    },
  });
  return { id: user.id, email: user.email, displayName };
}

export const as = (userId: string) => ({ [DEV_USER_HEADER]: userId });

/** A game from the seeded catalogue, with its ranks (lowest first), roles and modes. */
export async function seededGame(ctx: TestContext, slug = "valorant") {
  return ctx.prisma.game.findUniqueOrThrow({
    where: { slug },
    include: { ranks: { orderBy: { tierOrder: "asc" } }, roles: true, modes: true },
  });
}

/** A valid lobby body for POST /lobbies. */
export async function lobbyBody(ctx: TestContext, overrides: Record<string, unknown> = {}) {
  const game = await seededGame(ctx);
  return {
    gameId: game.id,
    modeId: game.modes[0]!.id,
    lobbyCode: "7KQ2-XP",
    visibility: "public",
    capacity: 5,
    startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    ...overrides,
  };
}
