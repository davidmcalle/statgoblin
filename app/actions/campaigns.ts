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

/** Create a campaign; returns the admin API key — the only time it's visible. */
export async function createCampaign(
  formData: FormData,
): Promise<{ ingestKey: string; campaignId: string }> {
  const userId = await requireUserId();
  const name = nameSchema.parse(formData.get("name"));
  const { key, hash } = generateIngestKey();
  const campaign = await prisma.campaign.create({
    data: {
      name,
      creatorId: userId,
      inviteCode: generateInviteCode(),
      ingestKeyHash: hash,
      members: { create: { userId, role: "gm" } },
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

/** Creator-only: invalidate the old key, return the new one (shown once). */
export async function regenerateIngestKey(campaignId: string): Promise<{ ingestKey: string }> {
  const userId = await requireUserId();
  await requireCreator(campaignId, userId);
  const { key, hash } = generateIngestKey();
  await prisma.campaign.update({ where: { id: campaignId }, data: { ingestKeyHash: hash } });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ingestKey: key };
}
