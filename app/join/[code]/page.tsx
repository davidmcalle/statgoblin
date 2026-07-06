import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { prisma } from "@/lib/db/prisma";
import { joinCampaign } from "@/app/actions/campaigns";

// Public landing for invite links. Signed-out users see a sign-in prompt (Clerk
// returns them here after); signed-in users confirm with one click. The join
// itself happens in the server action, which re-checks everything.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { userId } = await auth();
  const campaign = await prisma.campaign.findUnique({
    where: { inviteCode: code },
    select: { name: true, image: true },
  });

  if (!campaign) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p>This invite link isn&apos;t valid.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Join “{campaign.name}”?</h1>
      {userId ? (
        <form
          action={async () => {
            "use server";
            await joinCampaign(code);
          }}
        >
          <button className="rounded-md bg-gray-900 px-4 py-2 text-white dark:bg-white dark:text-gray-900">
            Join campaign
          </button>
        </form>
      ) : (
        <SignInButton forceRedirectUrl={`/join/${code}`}>
          <button className="rounded-md bg-gray-900 px-4 py-2 text-white dark:bg-white dark:text-gray-900">
            Sign in to join
          </button>
        </SignInButton>
      )}
    </main>
  );
}
