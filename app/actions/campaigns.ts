"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  generateIngestKey,
  generateInviteCode,
  requireCreator,
  requireMember,
  requireUserId,
  touchCampaign,
} from "@/lib/campaigns";
import {
  buildSummaryHeaderEmbed,
  isValidWebhookUrl,
  postWebhook,
  sessionLabelOf,
} from "@/lib/discord";
import { renderAwardCards } from "@/lib/cards";
import { getOrCreateSummary, type SummaryPayload } from "@/lib/summary";
import { sessions } from "@/lib/stats";
import { sessionDayFrom } from "@/lib/session-day";

// Server actions are untrusted entry points (reachable as POSTs without the
// UI) — every one re-authenticates via Clerk and re-authorizes against the DB.

const nameSchema = z.string().trim().min(1).max(80);

/** Create a campaign with a starter API key — the only time that key is visible. */
export async function createCampaign(
  formData: FormData,
): Promise<{ ingestKey: string; campaignId: string }> {
  const userId = await requireUserId();
  const name = nameSchema.parse(formData.get("name"));
  const { key, hash, prefix } = generateIngestKey();
  const campaign = await prisma.campaign.create({
    data: {
      name,
      creatorId: userId,
      inviteCode: generateInviteCode(),
      members: { create: { userId, role: "gm" } },
      apiKeys: { create: { name: "Foundry", keyHash: hash, keyPrefix: prefix } },
    },
  });
  revalidatePath("/");
  return { ingestKey: key, campaignId: campaign.id };
}

/** Join via invite code; idempotent for existing members. */
export async function joinCampaign(inviteCode: string): Promise<void> {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.findUnique({ where: { inviteCode } });
  if (!campaign) throw new Error("Invalid invite code");
  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: { campaignId: campaign.id, userId, role: "player" },
  });
  await touchCampaign(campaign.id);
  redirect(`/campaigns/${campaign.id}`);
}

/** Creator-only: rename / set image / Discord webhook. */
export async function updateCampaign(campaignId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  const name = nameSchema.parse(formData.get("name"));
  const image = z.string().trim().max(500).default("").parse(formData.get("image") ?? "");
  const discordWebhookUrl = z
    .string()
    .trim()
    .max(400)
    .default("")
    .parse(formData.get("discordWebhookUrl") ?? "");
  if (discordWebhookUrl && !isValidWebhookUrl(discordWebhookUrl)) {
    throw new Error("That doesn't look like a Discord webhook URL");
  }
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { name, image, discordWebhookUrl, activityAt: new Date() },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * Creator-only: post a generated summary of the picked sessions (up to 10) to
 * the campaign's Discord webhook. First send generates awards + the Claude
 * narrative and caches the result; resends reuse the cache verbatim.
 */
/** Resolve the picked session dates and build (or fetch) the summary. */
async function summaryFor(
  campaignId: string,
  dates: string[],
  regenerate: boolean,
): Promise<
  | { ok: true; campaign: { name: string; image: string; discordWebhookUrl: string }; payload: SummaryPayload; cached: boolean; images: Map<string, string> }
  | { ok: false; error: string }
> {
  const userId = await requireUserId();
  const campaign = await requireCreator(campaignId, userId);
  const all = await sessions(campaignId);
  const valid = new Map(all.map((s) => [s.date, s]));
  const picked = [...new Set(dates)]
    .filter((d) => valid.has(d))
    .sort()
    .slice(0, 10)
    .map((d) => valid.get(d)!);
  if (picked.length === 0) return { ok: false, error: "Pick at least one session" };

  const { payload, cached } = await getOrCreateSummary(campaignId, campaign.name, picked, regenerate);
  const actors = await prisma.actor.findMany({
    where: { campaignId, image: { not: "" } },
    select: { name: true, image: true },
  });
  return {
    ok: true,
    campaign,
    payload,
    cached,
    images: new Map(actors.map((a) => [a.name, a.image])),
  };
}

export type SummaryPreview = {
  ok: true;
  label: string;
  narrative: string | null;
  highlights: string[];
  totals: SummaryPayload["totals"];
  notables: SummaryPayload["notables"];
  cards: { title: string; dataUri: string }[];
  cached: boolean;
};

/**
 * Creator-only: generate (or fetch) the summary for the picked sessions and
 * return everything the dialog needs to show it — narrative, highlights,
 * notable rolls and the rendered award cards — without posting anything.
 */
export async function previewDiscordSummary(
  campaignId: string,
  dates: string[],
  regenerate = false,
): Promise<SummaryPreview | { ok: false; error: string }> {
  const result = await summaryFor(campaignId, dates, regenerate);
  if (!result.ok) return result;
  const { payload, images, cached } = result;
  const label = sessionLabelOf(payload.sessions);
  const cards = await renderAwardCards(payload.awards, images, label);
  return {
    ok: true,
    label,
    narrative: payload.narrative,
    highlights: payload.highlights ?? [],
    totals: payload.totals,
    notables: payload.notables,
    cards: cards.map((c) => ({
      title: c.title,
      dataUri: `data:image/png;base64,${c.data.toString("base64")}`,
    })),
    cached,
  };
}

export async function sendDiscordSummary(
  campaignId: string,
  dates: string[],
): Promise<{ sent: boolean; error?: string }> {
  const result = await summaryFor(campaignId, dates, false);
  if (!result.ok) return { sent: false, error: result.error };
  const { campaign, payload, images } = result;
  if (!campaign.discordWebhookUrl) {
    return { sent: false, error: "Set a Discord webhook URL in campaign settings first" };
  }

  const label = sessionLabelOf(payload.sessions);
  const cards = await renderAwardCards(payload.awards, images, label);
  try {
    await postWebhook(
      campaign.discordWebhookUrl,
      [buildSummaryHeaderEmbed(campaign.name, campaign.image, payload)],
      cards.map(({ name, data }) => ({ name, data })),
    );
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Failed to reach Discord" };
  }
  return { sent: true };
}

/** Creator-only: mint an additional API key; plaintext returned once. */
export async function createApiKey(
  campaignId: string,
  formData: FormData,
): Promise<{ ingestKey: string }> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  const name = nameSchema.parse(formData.get("name"));
  const { key, hash, prefix } = generateIngestKey();
  await prisma.apiKey.create({
    data: { campaignId, name, keyHash: hash, keyPrefix: prefix },
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ingestKey: key };
}

/**
 * Creator-only: link an actor to a member (their character) or clear the link
 * (back to the GM's monster/NPC bucket).
 */
export async function assignActor(actorId: string, assignedUserId: string | null): Promise<void> {
  const userId = await requireUserId();
  const actor = await prisma.actor.findUnique({ where: { id: actorId } });
  if (!actor) return;
  await requireCreator(actor.campaignId, userId);
  if (assignedUserId) {
    // Only members of the same campaign can own a character.
    const member = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: actor.campaignId, userId: assignedUserId } },
    });
    if (!member) throw new Error("Not a member of this campaign");
  }
  await prisma.actor.update({ where: { id: actorId }, data: { assignedUserId } });
  await touchCampaign(actor.campaignId);
  revalidatePath(`/campaigns/${actor.campaignId}`);
}

/**
 * Creator-only: hide (or reveal) death saves. Enabling opens a new hiding
 * window — death saves rolled from now on stay GM-only. Disabling reveals the
 * currently hidden ones permanently; re-enabling later can't re-hide them.
 */
export async function setHideDeathSaves(campaignId: string, hide: boolean): Promise<void> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  if (hide) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { hideDeathSaves: true, hideDeathSavesSince: new Date(), activityAt: new Date() },
    });
  } else {
    await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: { hideDeathSaves: false, hideDeathSavesSince: null, activityAt: new Date() },
      }),
      prisma.roll.updateMany({
        where: { campaignId, rollType: "death", isHidden: true },
        data: { isHidden: false },
      }),
    ]);
  }
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Foundry actor ids of the characters assigned to a user in a campaign. */
async function ownedActorFids(campaignId: string, userId: string): Promise<Set<string>> {
  const actors = await prisma.actor.findMany({
    where: { campaignId, assignedUserId: userId },
    select: { foundryActorId: true },
  });
  return new Set(actors.map((a) => a.foundryActorId));
}

/** Recount actors' live rolls after bulk deletions. */
async function recountActors(campaignId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE actors a SET roll_count = COALESCE(r.n, 0)
    FROM (SELECT actor_fid, COUNT(*) n FROM rolls
          WHERE campaign_id = ${campaignId}::uuid AND deleted_at IS NULL
          GROUP BY actor_fid) r
    WHERE a.campaign_id = ${campaignId}::uuid AND a.foundry_actor_id = r.actor_fid`;
}

/**
 * Creator-only: soft-delete one roll's whole message (an attack's damage rolls
 * go with it). Stamps deletedAt on the raw event — the source of truth — so a
 * reprocess keeps it deleted; every stat and panel already excludes deleted.
 */
export async function deleteRoll(rollId: string): Promise<void> {
  const userId = await requireUserId();
  const roll = await prisma.roll.findUnique({ where: { id: rollId } });
  if (!roll) return;
  // GM deletes anything; a player only their own characters' rolls.
  const member = await requireMember(roll.campaignId, userId);
  if (member.campaign.creatorId !== userId) {
    const owned = await ownedActorFids(roll.campaignId, userId);
    if (!roll.actorFid || !owned.has(roll.actorFid)) {
      throw new Error("You can only delete rolls made by your own characters");
    }
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.rawEvent.update({ where: { id: roll.rawEventId }, data: { deletedAt: now } }),
    prisma.roll.updateMany({ where: { rawEventId: roll.rawEventId }, data: { deletedAt: now } }),
  ]);
  await recountActors(roll.campaignId);
  revalidatePath(`/campaigns/${roll.campaignId}`);
}

/**
 * Creator-only bulk clear: by character, by session date, or both. At least
 * one filter required — nuking a whole campaign stays a deliberate,
 * repeated act rather than one misclick.
 */
export async function clearRolls(
  campaignId: string,
  filters: { actorFid?: string | null; date?: string | null },
): Promise<{ cleared: number }> {
  const userId = await requireUserId();
  const member = await requireMember(campaignId, userId);
  const isCreator = member.campaign.creatorId === userId;
  const actorFid = filters.actorFid || undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(filters.date ?? "") ? filters.date! : undefined;
  if (isCreator) {
    if (!actorFid && !date) throw new Error("Pick a character or a session first");
  } else {
    // Players clear only their own characters' rolls.
    if (!actorFid) throw new Error("Pick one of your characters");
    const owned = await ownedActorFids(campaignId, userId);
    if (!owned.has(actorFid)) throw new Error("Not your character");
  }

  const targets = await prisma.roll.findMany({
    where: {
      campaignId,
      deletedAt: null,
      ...(actorFid ? { actorFid } : {}),
      ...(date ? { sessionDate: sessionDayFrom(date) } : {}),
    },
    select: { rawEventId: true },
    distinct: ["rawEventId"],
  });
  const ids = targets.map((t) => t.rawEventId);
  if (ids.length > 0) {
    const now = new Date();
    await prisma.$transaction([
      prisma.rawEvent.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } }),
      prisma.roll.updateMany({ where: { rawEventId: { in: ids } }, data: { deletedAt: now } }),
    ]);
    await recountActors(campaignId);
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return { cleared: ids.length };
}

const kindSchema = z.enum(["pc", "npc", "monster"]).nullable();

/** Creator-only: tag an actor's kind (pc/npc/monster), or null for automatic. */
export async function setActorKind(actorId: string, kind: string | null): Promise<void> {
  const userId = await requireUserId();
  const actor = await prisma.actor.findUnique({ where: { id: actorId } });
  if (!actor) return;
  await requireCreator(actor.campaignId, userId);
  await prisma.actor.update({
    where: { id: actorId },
    data: { kindOverride: kindSchema.parse(kind) },
  });
  await touchCampaign(actor.campaignId);
  revalidatePath(`/campaigns/${actor.campaignId}`);
}

/**
 * Creator-only: remove a player from the campaign. Their character
 * assignments are cleared (actors return to the GM's unassigned bucket);
 * their rolls stay — history belongs to the campaign. The GM can't be removed.
 */
export async function removeMember(campaignId: string, memberUserId: string): Promise<void> {
  const userId = await requireUserId();
  const campaign = await requireCreator(campaignId, userId);
  if (memberUserId === campaign.creatorId) throw new Error("The GM can't be removed");
  await prisma.$transaction([
    prisma.campaignMember.deleteMany({ where: { campaignId, userId: memberUserId } }),
    prisma.actor.updateMany({
      where: { campaignId, assignedUserId: memberUserId },
      data: { assignedUserId: null },
    }),
  ]);
  await touchCampaign(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * Creator-only: move the selected rolls' messages to a different session day.
 * The override lives on the raw event, so reprocessing preserves it; whole
 * messages move together (an attack's damage rolls follow it).
 */
export async function assignRollsToSession(
  campaignId: string,
  rollIds: string[],
  date: string,
): Promise<{ moved: number }> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid session date");
  const ids = rollIds.slice(0, 500);
  if (ids.length === 0) return { moved: 0 };

  const targets = await prisma.roll.findMany({
    where: { campaignId, id: { in: ids } },
    select: { rawEventId: true },
    distinct: ["rawEventId"],
  });
  const eventIds = targets.map((t) => t.rawEventId);
  if (eventIds.length === 0) return { moved: 0 };

  const day = sessionDayFrom(date);
  await prisma.$transaction([
    prisma.rawEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { sessionOverride: day },
    }),
    prisma.roll.updateMany({
      where: { rawEventId: { in: eventIds } },
      data: { sessionDate: day },
    }),
  ]);
  await touchCampaign(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
  return { moved: eventIds.length };
}

/**
 * Creator-only: hard-delete the whole campaign — members, keys, raw events,
 * rolls (FK cascades), plus actors and derive state (no FK relation). Gone
 * means gone; the UI confirms loudly before calling this.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  await prisma.$transaction([
    prisma.actor.deleteMany({ where: { campaignId } }),
    prisma.deriveState.deleteMany({ where: { campaignId } }),
    prisma.campaign.delete({ where: { id: campaignId } }),
  ]);
  revalidatePath("/");
  redirect("/");
}

/** Creator-only: revoke one key. Other keys keep working. */
export async function deleteApiKey(keyId: string): Promise<void> {
  const userId = await requireUserId();
  const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!apiKey) return;
  await requireCreator(apiKey.campaignId, userId);
  await prisma.apiKey.delete({ where: { id: keyId } });
  revalidatePath(`/campaigns/${apiKey.campaignId}`);
}
