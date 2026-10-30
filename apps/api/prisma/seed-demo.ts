// Dev-only demo data: an admin, three players and two lobbies, for trying the API by hand.
// Safe to run repeatedly (fixed ids, upserts). Run after db:seed with: npm run db:seed:demo
// Sign in with the header x-dev-user-id: <id printed below> (needs DEV_AUTH=true).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SETTING_DEFAULTS, type RoleName } from "@chill-hub/shared";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("The demo seed never runs in production.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
});

const DOMAIN = SETTING_DEFAULTS.allowed_email_domains[0]!;
const HOUR = 60 * 60 * 1000;

type DemoUser = { id: string; handle: string; name: string; roles: RoleName[] };

const USERS: DemoUser[] = [
  { id: "00000000-0000-4000-8000-000000000001", handle: "demo_admin", name: "Demo Admin", roles: ["admin"] },
  { id: "00000000-0000-4000-8000-000000000002", handle: "demo_aye", name: "Demo Player Aye", roles: ["player"] },
  { id: "00000000-0000-4000-8000-000000000003", handle: "demo_bo", name: "Demo Player Bo", roles: ["player"] },
  { id: "00000000-0000-4000-8000-000000000004", handle: "demo_chit", name: "Demo Player Chit", roles: ["player"] },
];

const [, AYE, BO, CHIT] = USERS as [DemoUser, DemoUser, DemoUser, DemoUser];

const LOBBIES = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    host: AYE,
    members: [AYE, BO],
    visibility: "public",
    lobbyCode: "DEMO-PUBLIC",
    note: "Public demo lobby: everyone can see the code.",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    host: CHIT,
    members: [CHIT],
    visibility: "private",
    lobbyCode: "DEMO-PRIVATE",
    note: "Private demo lobby: only the host and members can see the code.",
  },
] as const;

async function seedUsers() {
  for (const [index, u] of USERS.entries()) {
    const email = `${u.handle}@${DOMAIN}`;
    const studentIdNumber = `DEMO-${index + 1}`;
    await prisma.user.upsert({
      where: { id: u.id },
      update: { status: "approved", deletedAt: null, suspendedUntil: null },
      create: { id: u.id, name: u.name, email, emailVerified: true, studentIdNumber, status: "approved" },
    });
    for (const role of u.roles) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: u.id, role } },
        update: {},
        create: { userId: u.id, role },
      });
    }
    // Earlier versions of this seed made the demo admin a player too.
    await prisma.userRole.deleteMany({ where: { userId: u.id, role: { notIn: u.roles } } });
    await prisma.profile.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, displayName: u.handle },
    });
    console.log(`  user: ${u.handle} (${u.roles.join(", ")}) x-dev-user-id: ${u.id}`);
  }
}

async function seedLobbies() {
  const game = await prisma.game.findUnique({
    where: { slug: "valorant" },
    include: { modes: { take: 1 } },
  });
  const mode = game?.modes[0];
  if (!game || !mode) throw new Error("Games catalogue not found. Run npm run db:seed first.");

  for (const l of LOBBIES) {
    // Refreshed on every run so the demo lobbies never expire out of browse.
    const lobby = {
      hostId: l.host.id,
      gameId: game.id,
      modeId: mode.id,
      lobbyCode: l.lobbyCode,
      visibility: l.visibility,
      capacity: 5,
      startsAt: new Date(Date.now() + 2 * HOUR),
      note: l.note,
      status: "open",
      closedAt: null,
    } as const;
    await prisma.lobby.upsert({ where: { id: l.id }, update: lobby, create: { id: l.id, ...lobby } });
    for (const member of l.members) {
      await prisma.lobbyMember.upsert({
        where: { lobbyId_userId: { lobbyId: l.id, userId: member.id } },
        update: { leftAt: null },
        create: { lobbyId: l.id, userId: member.id },
      });
    }
    console.log(`  lobby: ${l.visibility} ${game.name}, host ${l.host.handle}, id: ${l.id}`);
  }
}

async function main() {
  console.log("Seeding demo data...");
  await seedUsers();
  await seedLobbies();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
