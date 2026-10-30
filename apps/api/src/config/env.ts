import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const LOCAL_AUTH_SECRET = "local-development-only-secret-do-not-deploy";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see apps/api/.env.example)"),
    /** Dev-only identification via the x-dev-user-id header, alongside real sessions. */
    DEV_AUTH: z.stringbool().default(false),
    /** Signs sessions. Required in production; the fallback is for local development only. */
    BETTER_AUTH_SECRET: z.string().min(32).default(LOCAL_AUTH_SECRET),
    /** Public URL of the API. Required in production. */
    BETTER_AUTH_URL: z.url().optional(),
    AUTH_RATE_LIMIT: z.stringbool().default(true),
    /** Without these, emails are printed to the console (development only). */
    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).optional(),
    /** Comma-separated list of allowed browser origins. */
    CORS_ORIGINS: z.string().default("http://localhost:8081,http://localhost:19006"),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.DEV_AUTH), {
    message: "DEV_AUTH must never be enabled in production",
    path: ["DEV_AUTH"],
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    if (e.BETTER_AUTH_SECRET === LOCAL_AUTH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "Set a real secret in production" });
    }
    for (const key of ["BETTER_AUTH_URL", "RESEND_API_KEY", "MAIL_FROM"] as const) {
      if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required in production" });
    }
  });

export type Env = z.infer<typeof envSchema>;
export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
