import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  GameCreateInput,
  GameModeInput,
  GameRankCreateInput,
  GameRankUpdateInput,
  GameRoleInput,
  GameUpdateInput,
} from "@chill-hub/shared";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const GAME_INCLUDE = {
  ranks: { orderBy: { tierOrder: "asc" } },
  roles: { orderBy: { name: "asc" } },
  modes: { orderBy: { name: "asc" } },
} satisfies Prisma.GameInclude;

type ItemKind = "rank" | "role" | "mode";

/** Games catalogue (GAM-01 to GAM-03): games plus their ranks, roles and modes. */
@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive: boolean) {
    return this.prisma.game.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: GAME_INCLUDE,
    });
  }

  async get(id: string, includeInactive: boolean) {
    const game = await this.prisma.game.findUnique({ where: { id }, include: GAME_INCLUDE });
    if (!game || (!game.isActive && !includeInactive)) throw new NotFoundException("Game not found");
    return game;
  }

  create(input: GameCreateInput) {
    return this.prisma.game.create({ data: input, include: GAME_INCLUDE });
  }

  async update(id: string, input: GameUpdateInput) {
    const game = await this.get(id, true);
    const teamSize = input.teamSize ?? game.teamSize;
    const maxLobbySize = input.maxLobbySize ?? game.maxLobbySize;
    if (maxLobbySize < teamSize) throw new BadRequestException("maxLobbySize must be at least teamSize");
    return this.prisma.game.update({ where: { id }, data: input, include: GAME_INCLUDE });
  }

  async remove(id: string) {
    await this.get(id, true);
    const [lobbies, accounts] = await Promise.all([
      this.prisma.lobby.count({ where: { gameId: id } }),
      this.prisma.inGameAccount.count({ where: { gameId: id } }),
    ]);
    if (lobbies || accounts) {
      throw new ConflictException("This game is used by lobbies or player profiles. Set isActive to false to hide it.");
    }
    await this.prisma.game.delete({ where: { id } });
  }

  // ---------- ranks, roles, modes ----------

  async addRank(gameId: string, input: GameRankCreateInput) {
    await this.get(gameId, true);
    return this.prisma.gameRank.create({ data: { gameId, ...input } });
  }

  async updateRank(gameId: string, rankId: string, input: GameRankUpdateInput) {
    await this.findItem("rank", gameId, rankId);
    return this.prisma.gameRank.update({ where: { id: rankId }, data: input });
  }

  async addRole(gameId: string, input: GameRoleInput) {
    await this.get(gameId, true);
    return this.prisma.gameRole.create({ data: { gameId, ...input } });
  }

  async updateRole(gameId: string, roleId: string, input: GameRoleInput) {
    await this.findItem("role", gameId, roleId);
    return this.prisma.gameRole.update({ where: { id: roleId }, data: input });
  }

  async addMode(gameId: string, input: GameModeInput) {
    await this.get(gameId, true);
    return this.prisma.gameMode.create({ data: { gameId, ...input } });
  }

  async updateMode(gameId: string, modeId: string, input: GameModeInput) {
    await this.findItem("mode", gameId, modeId);
    return this.prisma.gameMode.update({ where: { id: modeId }, data: input });
  }

  async removeItem(kind: ItemKind, gameId: string, itemId: string) {
    await this.findItem(kind, gameId, itemId);
    if (kind === "mode" && (await this.prisma.lobby.count({ where: { modeId: itemId } }))) {
      throw new ConflictException("This mode is used by lobbies and can't be deleted");
    }
    if (kind === "rank") await this.prisma.gameRank.delete({ where: { id: itemId } });
    if (kind === "role") await this.prisma.gameRole.delete({ where: { id: itemId } });
    if (kind === "mode") await this.prisma.gameMode.delete({ where: { id: itemId } });
  }

  private async findItem(kind: ItemKind, gameId: string, id: string) {
    const where = { id, gameId };
    const item =
      kind === "rank"
        ? await this.prisma.gameRank.findFirst({ where })
        : kind === "role"
          ? await this.prisma.gameRole.findFirst({ where })
          : await this.prisma.gameMode.findFirst({ where });
    if (!item) throw new NotFoundException(`Game ${kind} not found`);
    return item;
  }
}
