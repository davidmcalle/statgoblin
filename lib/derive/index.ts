import { prisma } from "@/lib/db/prisma";
import { PARSER_VERSION, parseActor, parseRolls } from "./parse";

type RawEventRow = {
  id: string;
  campaignId: string;
  messageId: string;
  payload: unknown;
  firstSeenAt: Date;
  deletedAt: Date | null;
};

/**
 * (Re)derive one raw event: replace its roll rows and refresh the actor.
 * Idempotent — safe to call on every ingest upsert and from reprocess.
 */
export async function deriveRawEvent(event: RawEventRow): Promise<void> {
  const rolls = parseRolls(event.payload, event.firstSeenAt);
  const actor = parseActor(event.payload);

  await prisma.$transaction(async (tx) => {
    await tx.roll.deleteMany({ where: { rawEventId: event.id } });
    if (rolls.length > 0) {
      await tx.roll.createMany({
        data: rolls.map((r) => ({
          ...r,
          campaignId: event.campaignId,
          rawEventId: event.id,
          messageId: event.messageId,
          deletedAt: event.deletedAt,
        })),
      });
    }
    if (actor) {
      await tx.actor.upsert({
        where: {
          campaignId_foundryActorId: {
            campaignId: event.campaignId,
            foundryActorId: actor.foundryActorId,
          },
        },
        create: {
          campaignId: event.campaignId,
          ...actor,
          rollCount: rolls.length,
          lastSeenAt: new Date(),
        },
        update: { name: actor.name, image: actor.image, lastSeenAt: new Date() },
      });
    }
  });
}

/** Wipe + rebuild a campaign's derived tables from raw events. */
export async function reprocessCampaign(campaignId: string): Promise<{ events: number }> {
  await prisma.roll.deleteMany({ where: { campaignId } });
  await prisma.actor.deleteMany({ where: { campaignId } });

  const batchSize = 200;
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const events = await prisma.rawEvent.findMany({
      where: { campaignId },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (events.length === 0) break;
    for (const event of events) await deriveRawEvent(event);
    count += events.length;
    cursor = events[events.length - 1].id;
  }

  // Recount actor roll totals in one pass (per-event upserts don't aggregate).
  await prisma.$executeRaw`
    UPDATE actors a SET roll_count = COALESCE(r.n, 0)
    FROM (SELECT actor_fid, COUNT(*) n FROM rolls
          WHERE campaign_id = ${campaignId}::uuid AND deleted_at IS NULL
          GROUP BY actor_fid) r
    WHERE a.campaign_id = ${campaignId}::uuid AND a.foundry_actor_id = r.actor_fid`;

  await prisma.deriveState.upsert({
    where: { campaignId },
    create: { campaignId, parserVersion: PARSER_VERSION },
    update: { parserVersion: PARSER_VERSION },
  });
  return { events: count };
}

/** Reprocess every campaign whose derived data lags PARSER_VERSION. */
export async function reprocessStale(): Promise<void> {
  const campaigns = await prisma.campaign.findMany({ select: { id: true, name: true } });
  for (const c of campaigns) {
    const state = await prisma.deriveState.findUnique({ where: { campaignId: c.id } });
    if (state?.parserVersion === PARSER_VERSION) continue;
    const { events } = await reprocessCampaign(c.id);
    console.log(`reprocessed ${c.name}: ${events} events (parser v${PARSER_VERSION})`);
  }
}
