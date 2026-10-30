import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  PUBLIC_SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  type SettingKey,
  type SettingValues,
} from "@chill-hub/shared";
import { PrismaService } from "../../prisma/prisma.service";

const CACHE_MS = 30_000;

/** Admin-editable limits (ADM-06). Missing or invalid values fall back to the spec defaults. */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache: { values: SettingValues; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<SettingValues> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.values;
    const rows = await this.prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const values: Record<string, unknown> = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      const parsed = SETTING_SCHEMAS[row.key as SettingKey].safeParse(row.value);
      if (parsed.success) values[row.key] = parsed.data;
      else this.logger.warn(`Ignoring invalid value for setting "${row.key}"; using the default`);
    }
    this.cache = { values: values as SettingValues, at: Date.now() };
    return this.cache.values;
  }

  async get<K extends SettingKey>(key: K): Promise<SettingValues[K]> {
    return (await this.all())[key];
  }

  async set<K extends SettingKey>(key: K, rawValue: unknown, actorId: string) {
    const parsed = SETTING_SCHEMAS[key].safeParse(rawValue);
    if (!parsed.success) {
      throw new BadRequestException({
        message: `Invalid value for ${key}`,
        details: parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
      });
    }
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: parsed.data as object, updatedById: actorId },
      create: { key, value: parsed.data as object, updatedById: actorId },
    });
    this.cache = null;
    return { key, value: parsed.data };
  }

  async publicSettings() {
    const all = await this.all();
    return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, all[k]]));
  }

  /** ACC-02: only college email domains (or their subdomains) may register. */
  async isEmailDomainAllowed(email: string): Promise<boolean> {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const allowed = await this.get("allowed_email_domains");
    return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
  }

  clearCache() {
    this.cache = null;
  }
}
