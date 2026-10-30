import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { InGameAccountCreateInput, InGameAccountUpdateInput, ProfileUpsertInput } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export const IN_GAME_ACCOUNT_INCLUDE = {
  game: { select: { id: true, slug: true, name: true, inGameIdLabel: true } },
  rank: { select: { id: true, name: true, tierOrder: true } },
  preferredRoles: { select: { gameRole: { select: { id: true, name: true } } } },
} satisfies Prisma.InGameAccountInclude;
type InGameAccountRow = Prisma.InGameAccountGetPayload<{ include: typeof IN_GAME_ACCOUNT_INCLUDE }>;

export const toInGameAccountView = (a: InGameAccountRow) => ({
  id: a.id,
  game: a.game,
  inGameName: a.inGameName,
  rank: a.rank,
  preferredRoles: a.preferredRoles.map((r) => r.gameRole),
});

/** Profiles (PRO-01 to PRO-04) and in-game accounts. Public views never include email, real name or student ID. */
@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(userId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { userId, user: { deletedAt: null, status: { in: ["approved", "suspended"] } } },
    });
    if (!profile) throw new NotFoundException("Profile not found");
    return { ...profile, inGameAccounts: await this.listAccounts(userId) };
  }

  async getMine(actor: Actor) {
    const profile = await this.prisma.profile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw new NotFoundException("You haven't created a profile yet");
    return { ...profile, inGameAccounts: await this.listAccounts(actor.id) };
  }

  upsertMine(actor: Actor, input: ProfileUpsertInput) {
    return this.prisma.profile.upsert({
      where: { userId: actor.id },
      update: input,
      create: { userId: actor.id, ...input },
    });
  }

  // ---------- in-game accounts ----------

  async listAccounts(userId: string) {
    const rows = await this.prisma.inGameAccount.findMany({
      where: { userId },
      include: IN_GAME_ACCOUNT_INCLUDE,
      orderBy: { game: { sortOrder: "asc" } },
    });
    return rows.map(toInGameAccountView);
  }

  async createAccount(actor: Actor, input: InGameAccountCreateInput) {
    const game = await this.prisma.game.findFirst({ where: { id: input.gameId, isActive: true } });
    if (!game) throw new BadRequestException("Unknown game");
    await this.checkRankAndRoles(game.id, input.rankId, input.preferredRoleIds);
    const existing = await this.prisma.inGameAccount.findUnique({
      where: { userId_gameId: { userId: actor.id, gameId: game.id } },
    });
    if (existing) throw new ConflictException(`You already have a ${game.name} account. Edit it instead.`);
    const created = await this.prisma.inGameAccount.create({
      data: {
        userId: actor.id,
        gameId: game.id,
        inGameName: input.inGameName,
        rankId: input.rankId ?? null,
        preferredRoles: { create: input.preferredRoleIds.map((gameRoleId) => ({ gameRoleId })) },
      },
      include: IN_GAME_ACCOUNT_INCLUDE,
    });
    return toInGameAccountView(created);
  }

  async updateAccount(actor: Actor, id: string, input: InGameAccountUpdateInput) {
    const account = await this.findOwnAccount(actor, id);
    await this.checkRankAndRoles(account.gameId, input.rankId, input.preferredRoleIds);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.preferredRoleIds) {
        await tx.inGameAccountRole.deleteMany({ where: { inGameAccountId: id } });
        await tx.inGameAccountRole.createMany({
          data: input.preferredRoleIds.map((gameRoleId) => ({ inGameAccountId: id, gameRoleId })),
        });
      }
      return tx.inGameAccount.update({
        where: { id },
        data: {
          ...(input.inGameName !== undefined ? { inGameName: input.inGameName } : {}),
          ...(input.rankId !== undefined ? { rankId: input.rankId } : {}),
        },
        include: IN_GAME_ACCOUNT_INCLUDE,
      });
    });
    return toInGameAccountView(updated);
  }

  async deleteAccount(actor: Actor, id: string) {
    await this.findOwnAccount(actor, id);
    await this.prisma.inGameAccount.delete({ where: { id } });
  }

  private async findOwnAccount(actor: Actor, id: string) {
    const account = await this.prisma.inGameAccount.findFirst({ where: { id, userId: actor.id } });
    if (!account) throw new NotFoundException("In-game account not found");
    return account;
  }

  /** Ranks and roles must belong to the same game as the account. */
  private async checkRankAndRoles(gameId: string, rankId?: string | null, roleIds?: string[]) {
    if (rankId) {
      const rank = await this.prisma.gameRank.findFirst({ where: { id: rankId, gameId } });
      if (!rank) throw new BadRequestException("That rank doesn't belong to this game");
    }
    if (roleIds?.length) {
      const unique = [...new Set(roleIds)];
      const count = await this.prisma.gameRole.count({ where: { id: { in: unique }, gameId } });
      if (count !== unique.length) throw new BadRequestException("Some roles don't belong to this game");
    }
  }
}
