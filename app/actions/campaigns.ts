"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  generateIngestKey,
  generateInviteCode,
  requireCreator,
  requireUserId,
} from "@/lib/campaigns";

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
  redirect(`/campaigns/${campaign.id}`);
}

/** Creator-only: rename / set image. */
export async function updateCampaign(campaignId: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  const name = nameSchema.parse(formData.get("name"));
  const image = z.string().trim().max(500).default("").parse(formData.get("image") ?? "");
  await prisma.campaign.update({ where: { id: campaignId }, data: { name, image } });
  revalidatePath(`/campaigns/${campaignId}`);
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
  revalidatePath(`/campaigns/${actor.campaignId}`);
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
  revalidatePath(`/campaigns/${actor.campaignId}`);
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
