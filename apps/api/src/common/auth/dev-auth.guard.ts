import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleName } from "@chill-hub/shared";
import type { Request } from "express";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import type { Actor } from "./actor";
import { ALLOW_PENDING, IS_PUBLIC, REQUIRED_ROLES } from "./decorators";

export const DEV_USER_HEADER = "x-dev-user-id";

/**
 * TEMPORARY (step 2): identifies the user from the x-dev-user-id header.
 * Only active when DEV_AUTH=true, which is refused in production. Replaced by Better Auth in step 3a;
 * the account-status and role rules below stay.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets) ?? false;
    const roles = this.reflector.getAllAndOverride<RoleName[]>(REQUIRED_ROLES, targets) ?? [];
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const userId = req.header(DEV_USER_HEADER)?.trim();

    if (isPublic) {
      if (userId && this.env.DEV_AUTH) req.actor = (await this.loadActor(userId)) ?? undefined;
      return true;
    }
    if (!this.env.DEV_AUTH) throw new UnauthorizedException("Login is not available yet");
    if (!userId) throw new UnauthorizedException(`Missing ${DEV_USER_HEADER} header`);

    const actor = await this.loadActor(userId);
    if (!actor) throw new UnauthorizedException("Unknown user");

    this.checkStatus(actor, allowPending, req.method);
    if (roles.length && !roles.some((r) => actor.roles.includes(r))) {
      throw new ForbiddenException("You don't have permission to do this");
    }
    req.actor = actor;
    return true;
  }

  private checkStatus(actor: Actor, allowPending: boolean, method: string) {
    switch (actor.status) {
      case "banned":
        throw new ForbiddenException("This account is banned");
      case "pending":
      case "rejected":
        if (!allowPending) throw new ForbiddenException("Your account hasn't been approved yet");
        return;
      case "suspended": {
        const active = !actor.suspendedUntil || actor.suspendedUntil > new Date();
        // MOD-06: suspended users can still view content, but can't create or change anything.
        if (active && method !== "GET" && !allowPending) {
          const until = actor.suspendedUntil ? ` until ${actor.suspendedUntil.toISOString()}` : "";
          throw new ForbiddenException(`Your account is suspended${until}`);
        }
        return;
      }
      default:
        return;
    }
  }

  private async loadActor(userId: string): Promise<Actor | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      suspendedUntil: user.suspendedUntil,
      roles: user.roles.map((r) => r.role),
    };
  }
}
