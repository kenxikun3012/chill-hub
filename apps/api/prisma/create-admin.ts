// Creates an approved admin who can log in straight away, so someone can approve the first sign-ups.
// Run on the server with: npm run admin:create. The password is only asked for here, never stored in a file.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaPg } from "@prisma/adapter-pg";
import { emailSchema } from "@chill-hub/shared";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
});

/** Terminal output that can be muted, so the password isn't shown while it's typed. */
let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});

/** Asks in a terminal. Piped input (three lines: name, email, password) is read up front, since readline drops lines from it. */
async function askDetails() {
  if (!process.stdin.isTTY) {
    const [name = "", email = "", password = ""] = readFileSync(0, "utf8").split(/\r?\n/);
    return { name, email, password };
  }
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const name = await rl.question("Full name: ");
  const email = await rl.question("Email: ");
  process.stdout.write("Password (at least 8 characters): ");
  muted = true;
  const password = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  rl.close();
  return { name, email, password };
}

async function main() {
  const details = await askDetails();
  const name = details.name.trim();
  const email = emailSchema.parse(details.email);
  const { password } = details;

  if (!name) throw new Error("A name is required.");
  if (password.length < 8 || password.length > 128) throw new Error("The password must be 8 to 128 characters.");
  if (await prisma.user.findUnique({ where: { email } })) throw new Error(`${email} already has an account.`);

  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      status: "approved",
      roles: { create: [{ role: "admin" }, { role: "player" }] },
      accounts: { create: { accountId: id, providerId: "credential", password: await hashPassword(password) } },
    },
  });
  console.log(`Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
