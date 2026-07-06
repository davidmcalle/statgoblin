import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export type MemberInfo = { userId: string; name: string; role: string };

/** Campaign members with display names resolved from Clerk. */
export async function campaignMembers(campaignId: string): Promise<MemberInfo[]> {
  const members = await prisma.campaignMember.findMany({
    where: { campaignId },
    orderBy: { joinedAt: "asc" },
  });
  if (members.length === 0) return [];
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({
    userId: members.map((m) => m.userId),
    limit: members.length,
  });
  // First name is the display name at the table ("Jake", not an email).
  // Fallbacks cover accounts created before name capture was required; the
  // email local-part beats showing a full address in a dropdown.
  const nameOf = new Map(
    users.map((u) => [
      u.id,
      u.firstName ||
        u.username ||
        u.emailAddresses[0]?.emailAddress.split("@")[0] ||
        "Unknown",
    ]),
  );
  return members.map((m) => ({
    userId: m.userId,
    name: nameOf.get(m.userId) ?? "Unknown",
    role: m.role,
  }));
}
