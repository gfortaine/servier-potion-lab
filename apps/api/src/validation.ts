import { ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";

export function configureValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );
}
