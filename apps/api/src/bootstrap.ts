import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { Express } from "express";
import { AppModule } from "./app.module.js";
import { configureOpenApi } from "./openapi.js";
import { configureValidation } from "./validation.js";

export async function createConfiguredNestApp(expressInstance?: Express): Promise<INestApplication> {
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
    : await NestFactory.create(AppModule);

  app.enableCors({
    origin: readWebOrigins()
  });
  configureValidation(app);
  configureOpenApi(app);

  return app;
}

export function readWebOrigins(): string | readonly string[] {
  const configuredOrigin = process.env.WEB_ORIGIN;
  if (configuredOrigin) {
    return configuredOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
  }

  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}
