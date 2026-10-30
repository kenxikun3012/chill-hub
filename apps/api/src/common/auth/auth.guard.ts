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
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { ENV, type Env } from "../../config/env";
import { AuthService } from "../../modules/auth/auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { isStaff, type Actor } from "./actor";
import { ALLOW_PENDING, IS_PUBLIC, NO_STAFF, REQUIRED_ROLES } from "./decorators";

export const DEV_USER_HEADER = "x-dev-user-id";

/**
 * Identifies the user from their Better Auth session (cookie on web, bearer token in the app),
 * then applies the account-status and role rules. With DEV_AUTH=true, which is refused in production,
 * the x-dev-user-id header also works.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets) ?? false;
    const roles = this.reflector.getAllAndOverride<RoleName[]>(REQUIRED_ROLES, targets) ?? [];
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const userId = await this.identify(req);

    if (isPublic) {
      if (userId) req.actor = (await this.loadActor(userId)) ?? undefined;
      return true;
    }
    if (!userId) throw new UnauthorizedException("Please log in");

    const actor = await this.loadActor(userId);
    if (!actor) throw new UnauthorizedException("Unknown user");

    this.checkStatus(actor, allowPending, req.method);
    if (roles.length && !roles.some((r) => actor.roles.includes(r))) {
      throw new ForbiddenException("You don't have permission to do this");
    }
    if (this.reflector.getAllAndOverride<boolean>(NO_STAFF, targets) && isStaff(actor)) {
      throw new ForbiddenException("Staff accounts can't use lobbies");
    }
    req.actor = actor;
    return true;
  }

  private async identify(req: Request): Promise<string | undefined> {
    const devUserId = this.env.DEV_AUTH ? req.header(DEV_USER_HEADER)?.trim() : undefined;
    if (devUserId) return devUserId;
    const session = await this.authService.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return session?.user.id;
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
