import { BadRequestException, INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { DEV_USER_HEADER } from "./common/auth/dev-auth.guard";
import type { Env } from "./config/env";

export const API_PREFIX = "api/v1";

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication, env: Env) {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()) });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new BadRequestException({
          message: "Validation failed",
          details: issues.map((i) => {
            const path = (i.path ?? [])
              .map((p) => (typeof p === "object" && p !== null && "key" in p ? p.key : p))
              .join(".");
            return path ? `${path}: ${i.message}` : i.message;
          }),
        }),
    }),
  );
}

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Chill Hub API")
    .setDescription(
      "MVP-1 REST API. Until login arrives (step 3a), identify yourself with the " +
        `\`${DEV_USER_HEADER}\` header (dev only). List endpoints use cursor pagination: ?limit=&cursor=.`,
    )
    .setVersion("0.1.0")
    .addApiKey({ type: "apiKey", in: "header", name: DEV_USER_HEADER }, "dev-user")
    .addSecurityRequirements("dev-user")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, { jsonDocumentUrl: `${API_PREFIX}/openapi.json` });
}
