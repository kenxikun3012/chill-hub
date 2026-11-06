import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { RoleName } from "@chill-hub/shared";
import type { Actor } from "./actor";

export const IS_PUBLIC = "auth:isPublic";
export const ALLOW_PENDING = "auth:allowPending";
export const REQUIRED_ROLES = "auth:roles";
export const NO_STAFF = "auth:noStaff";

/** No login needed. If a user is identified anyway, req.actor is still set. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Pending and rejected users may call this route (ACC-06: they can only reach their own account). */
export const AllowPending = () => SetMetadata(ALLOW_PENDING, true);

/** The user needs at least one of these roles. */
export const Roles = (...roles: RoleName[]) => SetMetadata(REQUIRED_ROLES, roles);

/** Player features: moderators and admins are refused, even if they also hold the player role. Pass false to exempt one route. */
export const NoStaff = (blocked = true) => SetMetadata(NO_STAFF, blocked);

/** Injects the current user (Actor). Undefined only on @Public routes without a user. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor | undefined => ctx.switchToHttp().getRequest().actor,
);
