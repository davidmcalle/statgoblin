import { prisma } from "../lib/db/prisma";

// Dev seed: one campaign whose ingest token matches the module's test setting.
async function main() {
  await prisma.campaign.upsert({
    where: { ingestToken: "test" },
    update: {},
    create: {
      name: "Eldanar",
      ingestToken: "test",
      joinCode: "ELDANAR",
    },
  });
  console.log("seeded campaign Eldanar (ingestToken: test)");
}

main().finally(() => prisma.$disconnect());
