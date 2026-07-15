import { createHash, randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { publishCampaignActivity } from "@/lib/events";

// Credential helpers. An admin API key is 32 random bytes, hex-encoded, shown
// to the creator exactly once; only its sha256 (plus a display prefix) lands in
// the DB. Ingest looks up by hash, so a DB leak doesn't leak usable keys.
export function generateIngestKey(): { key: string; hash: string; prefix: string } {
  const key = `rw_${randomBytes(32).toString("hex")}`;
  return { key, hash: hashIngestKey(key), prefix: `${key.slice(0, 11)}…` };
}

export function hashIngestKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateInviteCode(): string {
  // URL-safe, short enough to share aloud at a table.
  return randomBytes(6).toString("base64url");
}

/** Clerk user id of the signed-in user, or throw — call at the top of every action. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  return userId;
}

/** The campaign, only if the user is its creator. */
export async function requireCreator(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.creatorId !== userId) throw new Error("Not your campaign");
  return campaign;
}

/** The campaign, only if the user is a member (any role). */
export async function requireMember(campaignId: string, userId: string) {
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
    include: { campaign: true },
  });
  if (!member) throw new Error("Not a member of this campaign");
  return member;
}

/**
 * Publish a shared mutation: bump the campaign's activity stamp so every
 * member's freshness poll (LiveRefresh → /latest) sees a new version and
 * re-renders. Call from any action whose effect other members should see.
 */
export async function touchCampaign(campaignId: string): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { activityAt: new Date() },
  });
  publishCampaignActivity(campaignId);
}
