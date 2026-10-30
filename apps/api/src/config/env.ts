import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see apps/api/.env.example)"),
    /** Dev-only identification via the x-dev-user-id header. Replaced by Better Auth in step 3a. */
    DEV_AUTH: z.stringbool().default(false),
    /** Comma-separated list of allowed browser origins. */
    CORS_ORIGINS: z.string().default("http://localhost:8081,http://localhost:19006"),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.DEV_AUTH), {
    message: "DEV_AUTH must never be enabled in production",
    path: ["DEV_AUTH"],
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
