import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { createOpenApiDocument } from "./openapi.js";

const outputPath = process.argv.slice(2).find((argument) => argument !== "--");
if (!outputPath) {
  throw new Error("Usage: node dist/export-openapi.js <output-path>");
}

const app = await NestFactory.create(AppModule, {
  logger: false,
  preview: true
});

try {
  const resolvedOutputPath = resolve(process.cwd(), outputPath);
  const document = createOpenApiDocument(app);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(document, null, 2)}\n`);
} finally {
  await app.close();
}
