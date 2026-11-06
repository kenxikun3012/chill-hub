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
    slug: "mobile-legends",
    name: "Mobile Legends: Bang Bang",
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
    slug: "dota-2",
    name: "Dota 2",
    platforms: ["pc"],
    teamSize: 5,
    maxLobbySize: 10,
    inGameIdLabel: "Friend ID",
    ranks: ["Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"],
    roles: ["Carry (Pos 1)", "Mid (Pos 2)", "Offlane (Pos 3)", "Soft Support (Pos 4)", "Hard Support (Pos 5)"],
    modes: ["Ranked", "Unranked", "Turbo", "Custom Lobby"],
  },
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
    slug: "genshin-impact",
    name: "Genshin Impact",
    platforms: ["pc", "mobile", "console"],
    teamSize: 4,
    maxLobbySize: 4,
    inGameIdLabel: "UID",
    ranks: ["AR 1-19", "AR 20-34", "AR 35-44", "AR 45-54", "AR 55-60"], // Adventure Rank bands
    roles: ["Main DPS", "Sub DPS", "Support", "Healer"],
    modes: ["Co-op Domain", "Spiral Abyss", "World Boss", "Exploration"],
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
  {
    slug: "honor-of-kings",
    name: "Honor of Kings",
    platforms: ["mobile"],
    teamSize: 5,
    maxLobbySize: 10,
    inGameIdLabel: "Player ID",
    ranks: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Epic", "Legend"],
    roles: ["Clash Lane", "Jungle", "Mid Lane", "Farm Lane", "Roaming"],
    modes: ["Ranked", "Classic", "Custom 5v5"],
  },
  {
    slug: "chess-com",
    name: "Chess.com",
    platforms: ["pc", "mobile"],
    teamSize: 1,
    maxLobbySize: 2,
    inGameIdLabel: "Chess.com username",
    ranks: ["Under 800", "800-1200", "1200-1600", "1600-2000", "2000+"], // rating bands
    roles: [],
    modes: ["Bullet", "Blitz", "Rapid", "Friendly"],
  },
];

// Settings defaults live in @chill-hub/shared so the API and seed always agree.
const SETTINGS: Record<string, unknown> = SETTING_DEFAULTS;
// Keys renamed in later versions; removed so stale values can't confuse anyone.
const OBSOLETE_SETTINGS = ["max_active_lobbies_per_host"];

async function seedGames() {
  // Games dropped from the list are hidden, not deleted, so old lobbies keep their game.
  const retired = await prisma.game.updateMany({ where: { slug: { notIn: GAMES.map((g) => g.slug) } }, data: { isActive: false } });
  if (retired.count) console.log(`  hid ${retired.count} game(s) no longer on the list`);
  for (const [index, g] of GAMES.entries()) {
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        platforms: g.platforms,
        teamSize: g.teamSize,
        maxLobbySize: g.maxLobbySize,
        inGameIdLabel: g.inGameIdLabel,
        isActive: true,
        sortOrder: index,
      },
      create: {
        slug: g.slug,
        name: g.name,
        platforms: g.platforms,
        teamSize: g.teamSize,
        maxLobbySize: g.maxLobbySize,
        inGameIdLabel: g.inGameIdLabel,
        isActive: true,
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
