import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { idSchema } from "@chill-hub/shared";
import { RatingsService } from "./ratings.service";

@ApiTags("Ratings")
@Controller("users")
export class ReputationController {
  constructor(private readonly ratings: RatingsService) {}

  /** REP-02: totals only; individual raters are never shown. */
  @Get(":id/reputation")
  reputation(@Param("id", { schema: idSchema }) id: string) {
    return this.ratings.reputation(id);
  }
}
