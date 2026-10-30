import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { settingKeySchema, settingUpdateSchema, type SettingKey, type SettingUpdateInput } from "@chill-hub/shared";
import type { Actor } from "../../common/auth/actor";
import { CurrentActor, Public, Roles } from "../../common/auth/decorators";
import { SettingsService } from "./settings.service";

@ApiTags("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Settings any client may read, e.g. the allowed email domains for the sign-up form. */
  @Public()
  @Get("public")
  publicSettings() {
    return this.settings.publicSettings();
  }

  @Roles("admin")
  @Get()
  all() {
    return this.settings.all();
  }

  @Roles("admin")
  @Get(":key")
  async one(@Param("key", { schema: settingKeySchema }) key: SettingKey) {
    return { key, value: await this.settings.get(key) };
  }

  @Roles("admin")
  @Put(":key")
  update(
    @Param("key", { schema: settingKeySchema }) key: SettingKey,
    @Body({ schema: settingUpdateSchema }) body: SettingUpdateInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.settings.set(key, body.value, actor.id);
  }
}
