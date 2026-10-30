import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  approvalDecisionSchema,
  approvalsListQuerySchema,
  idSchema,
  userCreateSchema,
  userRolesSchema,
  usersListQuerySchema,
  userUpdateSchema,
  type ApprovalDecisionInput,
  type ApprovalsListQuery,
  type UserCreateInput,
  type UserRolesInput,
  type UsersListQuery,
  type UserUpdateInput,
} from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { AllowPending, CurrentActor, Roles } from "../../common/auth/decorators";
import { ApprovalsService } from "./approvals.service";
import { UsersService } from "./users.service";

/** The current user's own account. */
@ApiTags("Me")
@AllowPending()
@Controller("me")
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly approvals: ApprovalsService,
  ) {}

  @Get()
  me(@CurrentActor() actor: Actor) {
    return this.users.get(actor.id);
  }

  /** ACC-10: delete my account. */
  @Delete()
  @HttpCode(204)
  deleteMe(@CurrentActor() actor: Actor) {
    return this.users.softDelete(actor.id);
  }

  @Get("approval-requests")
  myApprovalRequests(@CurrentActor() actor: Actor) {
    return this.approvals.mine(actor);
  }

  /** Ask for review again after a rejection (or the first time). */
  @Post("approval-requests")
  submitApprovalRequest(@CurrentActor() actor: Actor) {
    return this.approvals.submit(actor);
  }
}

/** Staff user management (ADM-03). Moderators can read; only admins can change. */
@ApiTags("Users (staff)")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles("admin", "moderator")
  @Get()
  list(@Query({ schema: usersListQuerySchema }) q: UsersListQuery) {
    return this.users.list(q);
  }

  @Roles("admin", "moderator")
  @Get(":id")
  get(@Param("id", { schema: idSchema }) id: string) {
    return this.users.get(id);
  }

  @Roles("admin")
  @Post()
  create(@Body({ schema: userCreateSchema }) body: UserCreateInput) {
    return this.users.create(body);
  }

  @Roles("admin")
  @Patch(":id")
  update(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: userUpdateSchema }) body: UserUpdateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.users.update(id, body, actor);
  }

  @Roles("admin")
  @Put(":id/roles")
  setRoles(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: userRolesSchema }) body: UserRolesInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.users.setRoles(id, body.roles, actor);
  }

  @Roles("admin")
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", { schema: idSchema }) id: string) {
    return this.users.softDelete(id);
  }
}

/** Sign-up approval queue (ADM-02). */
@ApiTags("Approvals (admin)")
@Roles("admin")
@Controller("approval-requests")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@Query({ schema: approvalsListQuerySchema }) q: ApprovalsListQuery) {
    return this.approvals.list(q);
  }

  @Get(":id")
  get(@Param("id", { schema: idSchema }) id: string) {
    return this.approvals.get(id);
  }

  @Patch(":id")
  decide(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: approvalDecisionSchema }) body: ApprovalDecisionInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.approvals.decide(id, body, actor);
  }
}
