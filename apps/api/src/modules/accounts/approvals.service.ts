import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ApprovalDecisionInput, ApprovalsListQuery, SignUpDetailsInput } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { cursorArgs, toPage } from "../../common/http/pagination";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ProfilesService } from "../profiles/profiles.service";

const REQUEST_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      studentIdNumber: true,
      createdAt: true,
      inGameAccounts: { select: { inGameName: true, game: { select: { id: true, name: true } } } },
    },
  },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.ApprovalRequestInclude;

/** Admin review of sign-ups (ACC-03, ACC-04, ADM-02). */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly profiles: ProfilesService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Sign-up step 3, and fixing details after a rejection (ACC-06): saves the student ID number and
   * an in-game ID, then joins the approval queue (ACC-03). Safe to retry if a step fails.
   */
  async submitDetails(actor: Actor, input: SignUpDetailsInput) {
    await this.assertCanSubmit(actor);
    await this.prisma.user.update({ where: { id: actor.id }, data: { studentIdNumber: input.studentIdNumber } });
    const { gameId, ...account } = input.inGameAccount;
    const existing = await this.prisma.inGameAccount.findUnique({ where: { userId_gameId: { userId: actor.id, gameId } } });
    if (existing) await this.profiles.updateAccount(actor, existing.id, account);
    else await this.profiles.createAccount(actor, input.inGameAccount);
    return this.submit(actor);
  }

  /** A pending or rejected user asks for (re-)review, with their details already saved. */
  async submit(actor: Actor) {
    await this.assertCanSubmit(actor);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { studentIdNumber: true, _count: { select: { inGameAccounts: true } } },
    });
    if (!user.studentIdNumber || !user._count.inGameAccounts) {
      throw new BadRequestException("Add your student ID number and an in-game ID first");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.id }, data: { status: "pending" } });
      return tx.approvalRequest.create({ data: { userId: actor.id } });
    });
  }

  private async assertCanSubmit(actor: Actor) {
    if (actor.status !== "pending" && actor.status !== "rejected") {
      throw new ConflictException("Your account doesn't need approval");
    }
    const open = await this.prisma.approvalRequest.findFirst({ where: { userId: actor.id, status: "pending" } });
    if (open) throw new ConflictException("You already have a request waiting for review");
  }

  mine(actor: Actor) {
    return this.prisma.approvalRequest.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, rejectReason: true, createdAt: true, reviewedAt: true },
    });
  }

  /** Oldest first, so nobody waits too long. */
  async list(q: ApprovalsListQuery) {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { status: q.status, user: { deletedAt: null } },
      include: REQUEST_INCLUDE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit);
  }

  async get(id: string) {
    const request = await this.prisma.approvalRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException("Approval request not found");
    return request;
  }

  async decide(id: string, input: ApprovalDecisionInput, admin: Actor) {
    const request = await this.get(id);
    if (request.status !== "pending") throw new ConflictException("This request has already been reviewed");
    const approve = input.decision === "approve";
    const rejectReason = input.decision === "reject" ? input.rejectReason : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id },
        data: { status: approve ? "approved" : "rejected", rejectReason, reviewedById: admin.id, reviewedAt: new Date() },
      });
      await tx.user.update({ where: { id: request.userId }, data: { status: approve ? "approved" : "rejected" } });
      if (approve) {
        await tx.userRole.upsert({
          where: { userId_role: { userId: request.userId, role: "player" } },
          update: {},
          create: { userId: request.userId, role: "player", grantedById: admin.id },
        });
      }
      await this.notifications.notify(
        [request.userId],
        approve
          ? { type: "account_approved", title: "You're approved!", body: "Welcome to Chill Hub. You can start playing now." }
          : { type: "account_rejected", title: "We couldn't approve your account", body: rejectReason ?? "" },
        tx,
      );
    });
    // ACC-05: push arrives in step 3d.
    this.authService.sendInBackground({
      to: request.user.email,
      subject: approve ? "You're approved on Chill Hub" : "Your Chill Hub application",
      text: approve
        ? "Welcome to Chill Hub. You can log in and start playing now."
        : `We couldn't approve your account: ${rejectReason}\n\nYou can fix your details and apply again in the app.`,
    });
    return this.get(id);
  }
}
