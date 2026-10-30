import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/decorators";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** For uptime monitoring (NFR-18): checks that the API can reach the database. */
  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok", time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException("Database unreachable");
    }
  }
}
