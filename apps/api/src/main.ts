import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { API_PREFIX, configureApp, setupSwagger } from "./app.setup";
import { ENV, type Env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  configureApp(app, env);
  if (env.NODE_ENV !== "production") setupSwagger(app);

  await app.listen(env.PORT);
  const logger = new Logger("Bootstrap");
  logger.log(`API listening on http://localhost:${env.PORT}/${API_PREFIX}`);
  if (env.NODE_ENV !== "production") logger.log(`Swagger UI: http://localhost:${env.PORT}/${API_PREFIX}/docs`);
  if (env.DEV_AUTH) logger.warn("DEV_AUTH is on: requests are identified by the x-dev-user-id header");
}

void bootstrap();
