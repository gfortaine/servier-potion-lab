import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { createPrismaClient } from "@servier-potion-lab/db";

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly client: ReturnType<typeof createPrismaClient>;

  constructor() {
    this.client = createPrismaClient();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
