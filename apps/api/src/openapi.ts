import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("SERVIER Potion Lab API")
    .setDescription("Inventory, recipe, and potion endpoints for the SERVIER technical test.")
    .setVersion("0.1.0")
    .addServer(process.env.API_PUBLIC_URL ?? "http://localhost:3001")
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function configureOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup("docs", app, document);
}
