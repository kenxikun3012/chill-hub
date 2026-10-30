import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  gameCreateSchema,
  gameModeCreateSchema,
  gameModeUpdateSchema,
  gameRankCreateSchema,
  gameRankUpdateSchema,
  gameRoleCreateSchema,
  gameRoleUpdateSchema,
  gamesListQuerySchema,
  gameUpdateSchema,
  idSchema,
  type GameCreateInput,
  type GameModeInput,
  type GameRankCreateInput,
  type GameRankUpdateInput,
  type GameRoleInput,
  type GamesListQuery,
  type GameUpdateInput,
} from "@chill-hub/shared";
import { hasRole, type Actor } from "../../common/auth/actor";
import { CurrentActor, Public, Roles } from "../../common/auth/decorators";
import { GamesService } from "./games.service";

@ApiTags("Games catalogue")
@Controller("games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  /** Public: the sign-up form needs the catalogue. Hidden games only for admins (?includeInactive=true). */
  @Public()
  @Get()
  list(@Query({ schema: gamesListQuerySchema }) q: GamesListQuery, @CurrentActor() actor?: Actor) {
    return this.games.list(!!q.includeInactive && hasRole(actor, "admin"));
  }

  @Public()
  @Get(":id")
  get(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor?: Actor) {
    return this.games.get(id, hasRole(actor, "admin"));
  }

  @Roles("admin")
  @Post()
  create(@Body({ schema: gameCreateSchema }) body: GameCreateInput) {
    return this.games.create(body);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id", { schema: idSchema }) id: string, @Body({ schema: gameUpdateSchema }) body: GameUpdateInput) {
    return this.games.update(id, body);
  }

  @Roles("admin")
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", { schema: idSchema }) id: string) {
    return this.games.remove(id);
  }

  // ----- ranks -----
  @Roles("admin")
  @Post(":id/ranks")
  addRank(@Param("id", { schema: idSchema }) id: string, @Body({ schema: gameRankCreateSchema }) body: GameRankCreateInput) {
    return this.games.addRank(id, body);
  }

  @Roles("admin")
  @Patch(":id/ranks/:itemId")
  updateRank(
    @Param("id", { schema: idSchema }) id: string,
    @Param("itemId", { schema: idSchema }) itemId: string,
    @Body({ schema: gameRankUpdateSchema }) body: GameRankUpdateInput,
  ) {
    return this.games.updateRank(id, itemId, body);
  }

  @Roles("admin")
  @Delete(":id/ranks/:itemId")
  @HttpCode(204)
  removeRank(@Param("id", { schema: idSchema }) id: string, @Param("itemId", { schema: idSchema }) itemId: string) {
    return this.games.removeItem("rank", id, itemId);
  }

  // ----- roles -----
  @Roles("admin")
  @Post(":id/roles")
  addRole(@Param("id", { schema: idSchema }) id: string, @Body({ schema: gameRoleCreateSchema }) body: GameRoleInput) {
    return this.games.addRole(id, body);
  }

  @Roles("admin")
  @Patch(":id/roles/:itemId")
  updateRole(
    @Param("id", { schema: idSchema }) id: string,
    @Param("itemId", { schema: idSchema }) itemId: string,
    @Body({ schema: gameRoleUpdateSchema }) body: GameRoleInput,
  ) {
    return this.games.updateRole(id, itemId, body);
  }

  @Roles("admin")
  @Delete(":id/roles/:itemId")
  @HttpCode(204)
  removeRole(@Param("id", { schema: idSchema }) id: string, @Param("itemId", { schema: idSchema }) itemId: string) {
    return this.games.removeItem("role", id, itemId);
  }

  // ----- modes -----
  @Roles("admin")
  @Post(":id/modes")
  addMode(@Param("id", { schema: idSchema }) id: string, @Body({ schema: gameModeCreateSchema }) body: GameModeInput) {
    return this.games.addMode(id, body);
  }

  @Roles("admin")
  @Patch(":id/modes/:itemId")
  updateMode(
    @Param("id", { schema: idSchema }) id: string,
    @Param("itemId", { schema: idSchema }) itemId: string,
    @Body({ schema: gameModeUpdateSchema }) body: GameModeInput,
  ) {
    return this.games.updateMode(id, itemId, body);
  }

  @Roles("admin")
  @Delete(":id/modes/:itemId")
  @HttpCode(204)
  removeMode(@Param("id", { schema: idSchema }) id: string, @Param("itemId", { schema: idSchema }) itemId: string) {
    return this.games.removeItem("mode", id, itemId);
  }
}
