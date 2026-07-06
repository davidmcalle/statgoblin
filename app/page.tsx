import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { CreateCampaignForm } from "./_components/create-campaign-form";
import { JoinCampaignForm } from "./_components/join-campaign-form";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-4xl font-bold">Your table rolls a lot of dice.</h1>
        <p className="max-w-md text-gray-600 dark:text-gray-400">
          Rollwatch collects every roll from your Foundry game — the nat 20s, the clutch saves,
          the cursed luck. Sign in to start a campaign or join your table.
        </p>
        <div className="flex gap-3">
          <SignInButton>
            <button className="rounded-md bg-gray-900 px-4 py-2 text-white dark:bg-white dark:text-gray-900">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="rounded-md border border-gray-300 px-4 py-2 dark:border-gray-700">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </main>
    );
  }

  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    include: { campaign: { include: { _count: { select: { events: true, members: true } } } } },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <h1 className="mb-6 text-2xl font-bold">Your campaigns</h1>
      {memberships.length === 0 && (
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          No campaigns yet — create one, or join with an invite code.
        </p>
      )}
      <ul className="mb-8 space-y-3">
        {memberships.map(({ campaign, role }) => (
          <li key={campaign.id}>
            <Link
              href={`/campaigns/${campaign.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              {campaign.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={campaign.image} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-2xl dark:bg-gray-800">
                  🎲
                </span>
              )}
              <span className="flex-1">
                <span className="block font-semibold">{campaign.name}</span>
                <span className="text-sm text-gray-500">
                  {role === "gm" ? "GM" : "Player"} · {campaign._count.members} members ·{" "}
                  {campaign._count.events} rolls
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 sm:grid-cols-2">
        <CreateCampaignForm />
        <JoinCampaignForm />
      </div>
    </main>
  );
}
