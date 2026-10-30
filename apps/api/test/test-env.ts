import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env"), quiet: true });

/**
 * The tests wipe their database on every run, so they only run against TEST_DATABASE_URL,
 * and refuse to start if it points at the same host as the dev DATABASE_URL.
 */
export function testDatabaseEnv() {
  const url = process.env["TEST_DATABASE_URL"];
  const directUrl = process.env["TEST_DIRECT_URL"] ?? url;
  if (!url || !directUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Create a Neon branch called 'test' and add TEST_DATABASE_URL and " +
        "TEST_DIRECT_URL to apps/api/.env (see docs/api/README.md#testing).",
    );
  }
  for (const devKey of ["DATABASE_URL", "DIRECT_URL"]) {
    const dev = process.env[devKey];
    if (dev && sameHost(dev, url)) {
      throw new Error(`TEST_DATABASE_URL points at the same database host as ${devKey}. Refusing to wipe it.`);
    }
  }
  return { url, directUrl };
}

function sameHost(a: string, b: string) {
  try {
    const host = (u: string) => new URL(u).hostname.replace("-pooler", "");
    return host(a) === host(b) && new URL(a).port === new URL(b).port;
  } catch {
    return a === b;
  }
}
