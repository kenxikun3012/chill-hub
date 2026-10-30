import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { RatingValue } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";

export interface Reputation {
  good: number;
  noShow: number;
  totalRatings: number;
  /** Percentage of ratings that were "no-show", 0–100 (0 when there are no ratings). */
  noShowRate: number;
  lobbiesPlayed: number;
}

/** Post-match feedback (REP-01 to REP-04). Raters stay anonymous (REP-02). */
@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Create or change my rating of one teammate. Changes are allowed until editable_until (REP-03). */
  async upsert(lobbyId: string, rateeId: string, value: RatingValue, actor: Actor) {
    if (rateeId === actor.id) throw new BadRequestException("You can't rate yourself");
    const lobby = await this.prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) throw new NotFoundException("Lobby not found");
    if (lobby.status !== "closed" && lobby.status !== "expired") {
      throw new ConflictException("Ratings open when the lobby ends");
    }
    const [rater, ratee] = await Promise.all([this.wasMember(lobby, actor.id), this.wasMember(lobby, rateeId)]);
    if (!rater) throw new ForbiddenException("Only players who were in this lobby can rate");
    if (!ratee) throw new BadRequestException("That player wasn't in this lobby");

    const existing = await this.prisma.rating.findUnique({
      where: { lobbyId_raterId_rateeId: { lobbyId, raterId: actor.id, rateeId } },
    });
    if (existing) {
      if (existing.editableUntil < new Date()) throw new ConflictException("This rating is locked and can't be changed");
      return this.prisma.rating.update({ where: { id: existing.id }, data: { value }, select: RATING_SELECT });
    }
    const hours = await this.settings.get("rating_edit_window_hours");
    return this.prisma.rating.create({
      data: { lobbyId, raterId: actor.id, rateeId, value, editableUntil: new Date(Date.now() + hours * 3_600_000) },
      select: RATING_SELECT,
    });
  }

  /** My ratings in a lobby, so the rating screen can show what I already chose. */
  mine(lobbyId: string, actor: Actor) {
    return this.prisma.rating.findMany({ where: { lobbyId, raterId: actor.id }, select: RATING_SELECT });
  }

  async reputation(userId: string): Promise<Reputation> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");
    return (await this.reputationFor([userId])).get(userId)!;
  }

  /** Reputation for several users at once (e.g. the host's join-request list). */
  async reputationFor(userIds: string[]): Promise<Map<string, Reputation>> {
    const ids = [...new Set(userIds)];
    const result = new Map<string, Reputation>(ids.map((id) => [id, { good: 0, noShow: 0, totalRatings: 0, noShowRate: 0, lobbiesPlayed: 0 }]));
    if (!ids.length) return result;
    const [counts, played] = await Promise.all([
      this.prisma.rating.groupBy({ by: ["rateeId", "value"], where: { rateeId: { in: ids } }, _count: { _all: true } }),
      this.prisma.lobbyMember.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, lobby: { status: { in: ["closed", "expired"] } } },
        _count: { _all: true },
      }),
    ]);
    for (const c of counts) {
      const r = result.get(c.rateeId)!;
      if (c.value === "good") r.good = c._count._all;
      else r.noShow = c._count._all;
    }
    for (const p of played) result.get(p.userId)!.lobbiesPlayed = p._count._all;
    for (const r of result.values()) {
      r.totalRatings = r.good + r.noShow;
      r.noShowRate = r.totalRatings ? Math.round((r.noShow / r.totalRatings) * 100) : 0;
    }
    return result;
  }

  /** Was in the lobby when it ended: still a member, or left after it closed. */
  private async wasMember(lobby: { id: string; closedAt: Date | null }, userId: string) {
    const m = await this.prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId: lobby.id, userId } } });
    return !!m && (!m.leftAt || (!!lobby.closedAt && m.leftAt >= lobby.closedAt));
  }
}

const RATING_SELECT = { id: true, lobbyId: true, rateeId: true, value: true, editableUntil: true, createdAt: true, updatedAt: true } as const;
