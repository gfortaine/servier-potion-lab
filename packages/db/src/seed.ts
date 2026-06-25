import { createRandomInventory } from "@servier-potion-lab/domain";
import { createPrismaClient, PrismaPotionRepository } from "./index.js";

const prisma = createPrismaClient();
const repository = new PrismaPotionRepository(prisma);

try {
  await repository.seedCatalog();
  await repository.clearPotions();
  await repository.replaceInventory(createRandomInventory(1, 5));
  console.log("SERVIER Prisma catalog and randomized inventory seeded.");
} finally {
  await prisma.$disconnect();
}
