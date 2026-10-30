import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  chatMessageCreateSchema,
  chatMessagesListQuerySchema,
  idSchema,
  joinRequestsListQuerySchema,
  joinRequestUpdateSchema,
  lobbiesListQuerySchema,
  lobbyCreateSchema,
  lobbyUpdateSchema,
  ratingUpsertSchema,
  type ChatMessageCreateInput,
  type ChatMessagesListQuery,
  type JoinRequestsListQuery,
  type JoinRequestUpdateInput,
  type LobbiesListQuery,
  type LobbyCreateInput,
  type LobbyUpdateInput,
  type RatingUpsertInput,
} from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { CurrentActor } from "../../common/auth/decorators";
import { RatingsService } from "../ratings/ratings.service";
import { LobbiesService } from "./lobbies.service";
import { LobbyChatService } from "./lobby-chat.service";
import { LobbyMembersService } from "./lobby-members.service";

@ApiTags("Lobbies")
@Controller("lobbies")
export class LobbiesController {
  constructor(
    private readonly lobbies: LobbiesService,
    private readonly members: LobbyMembersService,
    private readonly chat: LobbyChatService,
    private readonly ratings: RatingsService,
  ) {}

  /** Browse and filter (LOB-06). Defaults to open lobbies; ?mine=true for my active lobbies. */
  @Get()
  list(@Query({ schema: lobbiesListQuerySchema }) q: LobbiesListQuery, @CurrentActor() actor: Actor) {
    return this.lobbies.list(q, actor);
  }

  @Get(":id")
  get(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor: Actor) {
    return this.lobbies.get(id, actor);
  }

  @Post()
  create(@Body({ schema: lobbyCreateSchema }) body: LobbyCreateInput, @CurrentActor() actor: Actor) {
    return this.lobbies.create(body, actor);
  }

  /** Host edits, including changing the code, starting (in_progress) or closing the lobby. */
  @Patch(":id")
  update(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: lobbyUpdateSchema }) body: LobbyUpdateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.lobbies.update(id, body, actor);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor: Actor) {
    return this.lobbies.remove(id, actor);
  }

  // ---------- members ----------

  @Get(":id/members")
  listMembers(@Param("id", { schema: idSchema }) id: string) {
    return this.members.members(id);
  }

  /** Take a slot in a public lobby. */
  @Post(":id/members")
  join(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor: Actor) {
    return this.members.join(id, actor);
  }

  /** Leave (your own user ID) or, as host, remove a player. */
  @Delete(":id/members/:userId")
  @HttpCode(204)
  removeMember(
    @Param("id", { schema: idSchema }) id: string,
    @Param("userId", { schema: idSchema }) userId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.removeMember(id, userId, actor);
  }

  // ---------- join requests ----------

  @Post(":id/join-requests")
  requestToJoin(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor: Actor) {
    return this.members.requestToJoin(id, actor);
  }

  @Get(":id/join-requests")
  listRequests(
    @Param("id", { schema: idSchema }) id: string,
    @Query({ schema: joinRequestsListQuerySchema }) q: JoinRequestsListQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.listRequests(id, q, actor);
  }

  /** Host: accepted / declined. Requester: cancelled. */
  @Patch(":id/join-requests/:requestId")
  updateRequest(
    @Param("id", { schema: idSchema }) id: string,
    @Param("requestId", { schema: idSchema }) requestId: string,
    @Body({ schema: joinRequestUpdateSchema }) body: JoinRequestUpdateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.updateRequest(id, requestId, body, actor);
  }

  // ---------- chat ----------

  @Get(":id/messages")
  messages(
    @Param("id", { schema: idSchema }) id: string,
    @Query({ schema: chatMessagesListQuerySchema }) q: ChatMessagesListQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.chat.list(id, q, actor);
  }

  @Post(":id/messages")
  sendMessage(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: chatMessageCreateSchema }) body: ChatMessageCreateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.chat.send(id, body.body, actor);
  }

  // ---------- post-match ratings ----------

  @Get(":id/ratings/mine")
  myRatings(@Param("id", { schema: idSchema }) id: string, @CurrentActor() actor: Actor) {
    return this.ratings.mine(id, actor);
  }

  @Put(":id/ratings/:rateeId")
  rate(
    @Param("id", { schema: idSchema }) id: string,
    @Param("rateeId", { schema: idSchema }) rateeId: string,
    @Body({ schema: ratingUpsertSchema }) body: RatingUpsertInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.ratings.upsert(id, rateeId, body.value, actor);
  }
}
