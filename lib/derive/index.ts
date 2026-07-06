import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PARSER_VERSION, parseActor, parseRolls } from "./parse";

/**
 * (Re)derive one raw event: replace its roll rows and refresh the actor.
 * Concurrent-safe: midi-qol fires create + several updates milliseconds apart,
 * so two derives for the same event can interleave delete/insert and trip the
 * (raw_event_id, roll_index) unique constraint. A per-event advisory lock
 * serializes them, and the payload is re-read inside the lock so the last
 * writer derives the freshest state.
 */
export async function deriveRawEvent(event: { id: string }): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${event.id}))`;
    const fresh = await tx.rawEvent.findUnique({ where: { id: event.id } });
    if (!fresh) return;

    const rolls = parseRolls(fresh.payload, fresh.firstSeenAt);
    const actor = parseActor(fresh.payload);

    await tx.roll.deleteMany({ where: { rawEventId: fresh.id } });
    if (rolls.length > 0) {
      await tx.roll.createMany({
        data: rolls.map((r) => ({
          ...r,
          dice: (r.dice ?? undefined) as Prisma.InputJsonValue | undefined,
          campaignId: fresh.campaignId,
          rawEventId: fresh.id,
          messageId: fresh.messageId,
          deletedAt: fresh.deletedAt,
        })),
      });
    }
    if (actor) {
      await tx.actor.upsert({
        where: {
          campaignId_foundryActorId: {
            campaignId: fresh.campaignId,
            foundryActorId: actor.foundryActorId,
          },
        },
        create: {
          campaignId: fresh.campaignId,
          ...actor,
          rollCount: rolls.length,
          lastSeenAt: new Date(),
        },
        update: {
          name: actor.name,
          image: actor.image,
          // Only overwrite when the payload actually knows (module ≥0.2.1 /
          // npc sheets) — don't null out earlier knowledge.
          ...(actor.actorType ? { actorType: actor.actorType } : {}),
          ...(actor.cr !== null ? { cr: actor.cr } : {}),
          lastSeenAt: new Date(),
        },
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
      select: { id: true },
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
