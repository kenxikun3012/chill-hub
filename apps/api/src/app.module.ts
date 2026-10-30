import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./common/auth/auth.guard";
import { CoreModule } from "./core/core.module";
import { AuthService } from "./modules/auth/auth.service";
import { ApprovalsService } from "./modules/accounts/approvals.service";
import { ApprovalsController, MeController, UsersController } from "./modules/accounts/accounts.controllers";
import { UsersService } from "./modules/accounts/users.service";
import { GamesController } from "./modules/games/games.controller";
import { GamesService } from "./modules/games/games.service";
import { HealthController } from "./modules/health/health.controller";
import { LobbiesController } from "./modules/lobbies/lobbies.controller";
import { LobbiesService } from "./modules/lobbies/lobbies.service";
import { LobbyChatService } from "./modules/lobbies/lobby-chat.service";
import { LobbyMembersService } from "./modules/lobbies/lobby-members.service";
import { NotificationsController } from "./modules/notifications/notifications.controller";
import { ProfilesController } from "./modules/profiles/profiles.controller";
import { ProfilesService } from "./modules/profiles/profiles.service";
import { RatingsService } from "./modules/ratings/ratings.service";
import { ReputationController } from "./modules/ratings/reputation.controller";
import { SettingsController } from "./modules/settings/settings.controller";

@Module({
  imports: [CoreModule],
  controllers: [
    HealthController,
    MeController,
    NotificationsController,
    ProfilesController,
    UsersController,
    ReputationController,
    ApprovalsController,
    GamesController,
    LobbiesController,
    SettingsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    UsersService,
    ApprovalsService,
    GamesService,
    ProfilesService,
    LobbiesService,
    LobbyMembersService,
    LobbyChatService,
    RatingsService,
  ],
})
export class AppModule {}
