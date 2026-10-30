import { BadRequestException, INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { DEV_USER_HEADER } from "./common/auth/auth.guard";
import { API_PREFIX } from "./common/http/api-prefix";
import type { Env } from "./config/env";
import { AuthService } from "./modules/auth/auth.service";

export { API_PREFIX };

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication, env: Env) {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ["set-auth-token"],
  });
  // Better Auth reads the raw request body, so it's mounted here, before Nest adds its body parsers on init.
  const authPath = `/${API_PREFIX}/auth/`;
  const authHandler = toNodeHandler(app.get(AuthService).auth);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith(authPath)) void authHandler(req, res);
    else next();
  });
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
      "MVP-1 REST API. Log in through /api/v1/auth (see docs/api/README.md) and send the token as a bearer header. " +
        `In development you can use the \`${DEV_USER_HEADER}\` header instead. List endpoints use cursor pagination: ?limit=&cursor=.`,
    )
    .setVersion("0.1.0")
    .addApiKey({ type: "apiKey", in: "header", name: DEV_USER_HEADER }, "dev-user")
    .addBearerAuth()
    .addSecurityRequirements("dev-user")
    .addSecurityRequirements("bearer")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, { jsonDocumentUrl: `${API_PREFIX}/openapi.json` });
}
