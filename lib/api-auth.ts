import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashIngestKey } from "@/lib/campaigns";

const uuidSchema = z.uuid();

/**
 * Campaign credentials for machine callers (Foundry ingest, the read API):
 * X-Campaign-Id identifies, a Bearer admin API key (stored hashed) authorizes.
 * Returns the campaign id or null; stamps the key's lastUsedAt in passing.
 */
export async function authorizeCampaignKey(request: Request): Promise<string | null> {
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const campaignId = uuidSchema.safeParse(request.headers.get("x-campaign-id")?.trim());
  if (!key || !campaignId.success) return null;

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashIngestKey(key) } });
  if (!apiKey || apiKey.campaignId !== campaignId.data) return null;

  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return apiKey.campaignId;
}
