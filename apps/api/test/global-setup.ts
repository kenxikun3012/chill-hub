import { execSync } from "node:child_process";
import path from "node:path";
import { testDatabaseEnv } from "./test-env";

/** Runs once before all test files: bring the test database up to date and load reference data. */
export default async function globalSetup() {
  const { url, directUrl } = testDatabaseEnv();
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: directUrl };
  const cwd = path.join(__dirname, "..");
  execSync("npx prisma migrate deploy", { cwd, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd, env, stdio: "pipe" });
}
