import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  idSchema,
  inGameAccountCreateSchema,
  inGameAccountUpdateSchema,
  profileUpsertSchema,
  type InGameAccountCreateInput,
  type InGameAccountUpdateInput,
  type ProfileUpsertInput,
} from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { AllowPending, CurrentActor } from "../../common/auth/decorators";
import { ProfilesService } from "./profiles.service";

@ApiTags("Profiles")
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /** Another player's public profile. */
  @Get("profiles/:userId")
  getPublic(@Param("userId", { schema: idSchema }) userId: string) {
    return this.profiles.getPublic(userId);
  }

  // Pending users can fill in their profile and in-game IDs during sign-up.
  @AllowPending()
  @Get("me/profile")
  getMine(@CurrentActor() actor: Actor) {
    return this.profiles.getMine(actor);
  }

  @AllowPending()
  @Put("me/profile")
  upsertMine(@CurrentActor() actor: Actor, @Body({ schema: profileUpsertSchema }) body: ProfileUpsertInput) {
    return this.profiles.upsertMine(actor, body);
  }

  @AllowPending()
  @Get("me/in-game-accounts")
  listMine(@CurrentActor() actor: Actor) {
    return this.profiles.listAccounts(actor.id);
  }

  @AllowPending()
  @Post("me/in-game-accounts")
  create(@CurrentActor() actor: Actor, @Body({ schema: inGameAccountCreateSchema }) body: InGameAccountCreateInput) {
    return this.profiles.createAccount(actor, body);
  }

  @AllowPending()
  @Patch("me/in-game-accounts/:id")
  update(
    @CurrentActor() actor: Actor,
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: inGameAccountUpdateSchema }) body: InGameAccountUpdateInput,
  ) {
    return this.profiles.updateAccount(actor, id, body);
  }

  @AllowPending()
  @Delete("me/in-game-accounts/:id")
  @HttpCode(204)
  remove(@CurrentActor() actor: Actor, @Param("id", { schema: idSchema }) id: string) {
    return this.profiles.deleteAccount(actor, id);
  }
}
