// Seeds reference data: the games catalogue and default system settings.
// Safe to run repeatedly (upserts). Run with: npm run db:seed (from the repo root or apps/api).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { SETTING_DEFAULTS } from "@chill-hub/shared";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
});

type GameSeed = {
  slug: string;
  name: string;
  platforms: string[];
  teamSize: number;
  maxLobbySize: number;
  inGameIdLabel: string;
  ranks: string[]; // lowest first
  roles: string[];
  modes: string[];
};

const GAMES: GameSeed[] = [
  {
    slug: "valorant",
    name: "Valorant",
    platforms: ["pc"],
    teamSize: 5,
    maxLobbySize: 10,
    inGameIdLabel: "Riot ID (name#tag)",
    ranks: ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"],
    roles: ["Duelist", "Controller", "Initiator", "Sentinel", "IGL"],
    modes: ["Competitive", "Unrated", "Swiftplay", "Spike Rush", "Custom 5v5"],
  },
  {
    slug: "mobile-legends",
    name: "Mobile Legends",
    platforms: ["mobile"],
    teamSize: 5,
    maxLobbySize: 10,
    inGameIdLabel: "Player ID (Server ID)",
    ranks: ["Warrior", "Elite", "Master", "Grandmaster", "Epic", "Legend", "Mythic", "Mythical Honor", "Mythical Glory", "Mythical Immortal"],
    roles: ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"],
    modes: ["Classic", "Ranked", "Brawl", "Custom 5v5"],
  },
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    platforms: ["mobile"],
    teamSize: 4,
    maxLobbySize: 4,
    inGameIdLabel: "Character ID",
    ranks: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown", "Ace", "Ace Master", "Ace Dominator", "Conqueror"],
    roles: ["IGL", "Fragger", "Support", "Sniper", "Scout"],
    modes: ["Classic", "Ranked", "Arena", "Team Deathmatch"],
  },
  {
    slug: "ea-fc",
    name: "EA FC",
    platforms: ["console", "pc"],
    teamSize: 1,
    maxLobbySize: 11,
    inGameIdLabel: "EA ID",
    ranks: ["Division 10", "Division 9", "Division 8", "Division 7", "Division 6", "Division 5", "Division 4", "Division 3", "Division 2", "Division 1", "Elite"],
    roles: ["Goalkeeper", "Defender", "Midfielder", "Striker"],
    modes: ["Rivals", "Ultimate Team", "Pro Clubs", "Friendly"],
  },
  {
    slug: "league-of-legends",
    name: "League of Legends",
    platforms: ["pc"],
    teamSize: 5,
    maxLobbySize: 10,
    inGameIdLabel: "Riot ID (name#tag)",
    ranks: ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"],
    roles: ["Top", "Jungle", "Mid", "ADC", "Support"],
    modes: ["Ranked Solo/Duo", "Ranked Flex", "Normal Draft", "ARAM", "Custom"],
  },
];

// Settings defaults live in @chill-hub/shared so the API and seed always agree.
const SETTINGS: Record<string, unknown> = SETTING_DEFAULTS;
// Keys renamed in later versions; removed so stale values can't confuse anyone.
const OBSOLETE_SETTINGS = ["max_active_lobbies_per_host"];

async function seedGames() {
  for (const [index, g] of GAMES.entries()) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        platforms: g.platforms,
        teamSize: g.teamSize,
        maxLobbySize: g.maxLobbySize,
        inGameIdLabel: g.inGameIdLabel,
        sortOrder: index,
      },
      create: {
        slug: g.slug,
        name: g.name,
        platforms: g.platforms,
        teamSize: g.teamSize,
        maxLobbySize: g.maxLobbySize,
        inGameIdLabel: g.inGameIdLabel,
        sortOrder: index,
      },
    });

    for (const [i, name] of g.ranks.entries()) {
      await prisma.gameRank.upsert({
        where: { gameId_name: { gameId: game.id, name } },
        update: { tierOrder: i + 1 },
        create: { gameId: game.id, name, tierOrder: i + 1 },
      });
    }
    for (const name of g.roles) {
      await prisma.gameRole.upsert({
        where: { gameId_name: { gameId: game.id, name } },
        update: {},
        create: { gameId: game.id, name },
      });
    }
    for (const name of g.modes) {
      await prisma.gameMode.upsert({
        where: { gameId_name: { gameId: game.id, name } },
        update: {},
        create: { gameId: game.id, name },
      });
    }
    console.log(`  game: ${g.name} (${g.ranks.length} ranks, ${g.roles.length} roles, ${g.modes.length} modes)`);
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    // Only create missing settings; never overwrite values an admin has changed.
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as object },
    });
  }
  const removed = await prisma.setting.deleteMany({ where: { key: { in: OBSOLETE_SETTINGS } } });
  console.log(`  settings: ${Object.keys(SETTINGS).length} defaults${removed.count ? `, removed ${removed.count} obsolete` : ""}`);
}

async function main() {
  console.log("Seeding reference data...");
  await seedGames();
  await seedSettings();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
