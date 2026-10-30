import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ACTIVE_LOBBY_STATUSES, type RoleName, type UserCreateInput, type UsersListQuery, type UserUpdateInput } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { cursorArgs, toPage } from "../../common/http/pagination";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";

const USER_INCLUDE = {
  roles: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

/** Full account view: only for the user themselves and for staff (never public: PRO-04). */
export function toAccountView(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    studentIdNumber: u.studentIdNumber,
    status: u.status,
    suspendedUntil: u.suspendedUntil,
    roles: u.roles.map((r) => r.role),
    profile: u.profile,
    createdAt: u.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(q: UsersListQuery) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { roles: { some: { role: q.role } } } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: "insensitive" } },
              { email: { contains: q.q, mode: "insensitive" } },
              { studentIdNumber: { contains: q.q, mode: "insensitive" } },
              { profile: { displayName: { contains: q.q, mode: "insensitive" } } },
              { inGameAccounts: { some: { inGameName: { contains: q.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.user.findMany({
      where,
      include: USER_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(q),
    });
    return toPage(rows, q.limit, toAccountView);
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: USER_INCLUDE });
    if (!user) throw new NotFoundException("User not found");
    return toAccountView(user);
  }

  /** Admin-created account (no password yet; real sign-up arrives in step 3a). */
  async create(input: UserCreateInput) {
    if (!(await this.settings.isEmailDomainAllowed(input.email))) {
      throw new BadRequestException("Only college email addresses can be used");
    }
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        studentIdNumber: input.studentIdNumber,
        status: input.status ?? "pending",
        roles: input.roles?.length ? { create: input.roles.map((role) => ({ role })) } : undefined,
      },
      include: USER_INCLUDE,
    });
    return toAccountView(user);
  }

  async update(id: string, input: UserUpdateInput, actor: Actor) {
    const user = await this.get(id);
    if (input.status && id === actor.id) throw new BadRequestException("You can't change your own account status");
    const status = input.status ?? user.status;
    const suspendedUntil =
      status === "suspended" ? (input.suspendedUntil !== undefined ? input.suspendedUntil : user.suspendedUntil) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      // ACC-09: a banned user is logged out of every device.
      if (status === "banned") await tx.session.deleteMany({ where: { userId: id } });
      return tx.user.update({
        where: { id },
        data: { ...(input.name ? { name: input.name } : {}), status, suspendedUntil },
        include: USER_INCLUDE,
      });
    });
    return toAccountView(updated);
  }

  async setRoles(id: string, roles: RoleName[], actor: Actor) {
    await this.get(id);
    if (id === actor.id && !roles.includes("admin")) {
      throw new BadRequestException("You can't remove your own admin role");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id, role: { notIn: roles } } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: id, role, grantedById: actor.id })),
        skipDuplicates: true,
      });
      return tx.user.findUniqueOrThrow({ where: { id }, include: USER_INCLUDE });
    });
    return toAccountView(updated);
  }

  /**
   * ACC-10: removes personal data and logs the user out everywhere. The row stays (soft delete)
   * so lobbies, chat and ratings keep working and can show "Deleted user".
   */
  async softDelete(id: string) {
    await this.get(id);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.account.deleteMany({ where: { userId: id } });
      await tx.pushToken.deleteMany({ where: { userId: id } });
      await tx.inGameAccount.deleteMany({ where: { userId: id } });
      await tx.profile.deleteMany({ where: { userId: id } });
      await tx.lobbyMember.updateMany({ where: { userId: id, leftAt: null }, data: { leftAt: now } });
      await tx.lobby.updateMany({
        where: { hostId: id, status: { in: [...ACTIVE_LOBBY_STATUSES] } },
        data: { status: "closed", closedAt: now },
      });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.user.update({
        where: { id },
        data: {
          name: "Deleted user",
          email: `deleted+${id}@deleted.invalid`,
          studentIdNumber: `deleted:${id}`,
          image: null,
          emailVerified: false,
          deletedAt: now,
        },
      });
    });
  }
}
