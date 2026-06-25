import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPrismaClient, PrismaPotionRepository } from "@servier-potion-lab/db";
import { PotionLabApplication } from "@servier-potion-lab/domain";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import { createPotionMcpServer } from "./tools.js";

export async function startPotionMcpServer(): Promise<void> {
  const prisma = createPrismaClient();
  const repository = new PrismaPotionRepository(prisma);
  const application = new PotionLabApplication(repository, repository);
  const service = new PotionToolService(application);
  const server = createPotionMcpServer(service);

  process.on("SIGINT", () => {
    void shutdown(server, prisma);
  });
  process.on("SIGTERM", () => {
    void shutdown(server, prisma);
  });

  await server.connect(new StdioServerTransport());
}

async function shutdown(
  server: Awaited<ReturnType<typeof createPotionMcpServer>>,
  prisma: ReturnType<typeof createPrismaClient>
): Promise<void> {
  await server.close();
  await prisma.$disconnect();
}
