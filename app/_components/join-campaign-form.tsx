"use client";

import { useState, useTransition } from "react";
import { joinCampaign } from "@/app/actions/campaigns";

export function JoinCampaignForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  return (
    <form
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      action={() => {
        setError(null);
        startTransition(async () => {
          try {
            await joinCampaign(code.trim());
          } catch {
            setError("Invalid invite code.");
          }
        });
      }}
    >
      <h2 className="mb-2 font-semibold">Join a campaign</h2>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        placeholder="Invite code"
        className="mb-3 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={pending}
        className="rounded-md border border-gray-300 px-4 py-2 disabled:opacity-50 dark:border-gray-700"
      >
        {pending ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
