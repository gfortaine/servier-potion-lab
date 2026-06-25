import { Module } from "@nestjs/common";
import { PrismaPotionRepository } from "@servier-potion-lab/db";
import { PotionLabApplication } from "@servier-potion-lab/domain";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import { AssistantController } from "./assistant.controller.js";
import { AssistantService } from "./assistant.service.js";
import { AppController } from "./app.controller.js";
import { CodexChatService } from "./codex-chat.service.js";
import { PrismaService } from "./prisma.service.js";
import { PotionLabController } from "./potion-lab.controller.js";
import { PotionLabService } from "./potion-lab.service.js";

@Module({
  controllers: [AppController, AssistantController, PotionLabController],
  providers: [
    AssistantService,
    PrismaService,
    {
      provide: PrismaPotionRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaPotionRepository(prisma.client)
    },
    {
      provide: PotionLabApplication,
      inject: [PrismaPotionRepository],
      useFactory: (repository: PrismaPotionRepository) =>
        new PotionLabApplication(repository, repository)
    },
    {
      provide: PotionToolService,
      inject: [PotionLabApplication],
      useFactory: (application: PotionLabApplication) => new PotionToolService(application)
    },
    {
      provide: CodexChatService,
      inject: [PotionToolService],
      useFactory: (tools: PotionToolService) => new CodexChatService(tools)
    },
    PotionLabService
  ]
})
export class AppModule {}
