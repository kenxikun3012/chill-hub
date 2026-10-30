import { Inject, Injectable, Logger } from "@nestjs/common";
import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP } from "better-auth/plugins";
import { API_PREFIX } from "../../common/http/api-prefix";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { Mailer, type Mail } from "./mailer";

const DAY = 60 * 60 * 24;
const CODE_MINUTES = 10;

/** Better Auth routes we don't offer: login is by password only, and account details change through /me. */
const DISABLED_PATHS = [
  "/sign-in/email-otp",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

type CodeType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const CODE_SUBJECTS: Partial<Record<CodeType, string>> = {
  "email-verification": "Your Chill Hub verification code",
  "forget-password": "Your Chill Hub password reset code",
};

/** Better Auth inside the API: sign-up, email codes, login, password reset and sessions (ACC-01, 02, 07; NFR-09). */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  readonly auth;

  constructor(
    prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: Mailer,
    @Inject(ENV) env: Env,
  ) {
    this.auth = betterAuth({
      appName: "Chill Hub",
      baseURL: env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}`,
      basePath: `/${API_PREFIX}/auth`,
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      // disableOriginCheck is set because Better Auth would otherwise turn the check off when NODE_ENV=test.
      advanced: { database: { generateId: "uuid" }, disableOriginCheck: false },
      disabledPaths: DISABLED_PATHS,
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        revokeSessionsOnPasswordReset: true,
      },
      emailVerification: { autoSignInAfterVerification: true, sendOnSignIn: true },
      session: { expiresIn: 30 * DAY, updateAge: DAY },
      rateLimit: {
        enabled: env.AUTH_RATE_LIMIT,
        customRules: {
          "/sign-in/email": { window: 60, max: 5 },
          "/sign-up/email": { window: 60, max: 5 },
        },
      },
      plugins: [
        bearer(),
        emailOTP({
          otpLength: 6,
          expiresIn: CODE_MINUTES * 60,
          allowedAttempts: 5,
          storeOTP: "hashed",
          sendVerificationOnSignUp: true,
          overrideDefaultEmailVerification: true,
          disableSignUp: true,
          sendVerificationOTP: async ({ email, otp, type }) => this.sendCode(email, otp, type),
        }),
      ],
      databaseHooks: {
        user: {
          create: {
            before: async (user) => {
              if (!(await this.settings.isEmailDomainAllowed(user.email))) {
                throw new APIError("BAD_REQUEST", { message: "Only college email addresses can be used" });
              }
            },
          },
        },
        session: {
          create: {
            before: async (session) => {
              const user = await prisma.user.findUnique({ where: { id: session.userId } });
              // ACC-09: banned users can't log in again.
              if (!user || user.deletedAt || user.status === "banned") {
                throw new APIError("FORBIDDEN", { message: "This account can't log in" });
              }
            },
          },
        },
      },
    });
  }

  /** Sends without waiting, so response times don't reveal whether an email is registered. */
  sendInBackground(mail: Mail) {
    this.mailer.send(mail).catch((err: unknown) => {
      this.logger.error(`Couldn't send "${mail.subject}": ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private sendCode(to: string, code: string, type: CodeType) {
    const subject = CODE_SUBJECTS[type];
    if (!subject) return; // no passwordless login or email change codes
    this.sendInBackground({
      to,
      subject,
      text: `Your code is ${code}. It expires in ${CODE_MINUTES} minutes. If this wasn't you, you can ignore this email.`,
    });
  }
}
