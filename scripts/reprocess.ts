import { prisma } from "../lib/db/prisma";
import { reprocessCampaign, reprocessStale } from "../lib/derive";

// npm run reprocess           → rebuild campaigns behind PARSER_VERSION
// npm run reprocess -- --all  → force-rebuild everything
async function main() {
  if (process.argv.includes("--all")) {
    const campaigns = await prisma.campaign.findMany({ select: { id: true, name: true } });
    for (const c of campaigns) {
      const { events } = await reprocessCampaign(c.id);
      console.log(`reprocessed ${c.name}: ${events} events`);
    }
  } else {
    await reprocessStale();
  }
}

main().finally(() => prisma.$disconnect());
