import type { RoleName, UserStatus } from "@chill-hub/shared";

/** The user making the request. Set on req.actor by the auth guard. */
export interface Actor {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  suspendedUntil: Date | null;
  roles: RoleName[];
}

export const hasRole = (actor: Actor | undefined, ...roles: RoleName[]): boolean =>
  !!actor && roles.some((r) => actor.roles.includes(r));

export const isStaff = (actor: Actor | undefined) => hasRole(actor, "admin", "moderator");
