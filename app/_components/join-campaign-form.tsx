"use client";

import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { joinCampaign } from "@/app/actions/campaigns";

export function JoinCampaignForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  return (
    <form
      className="rounded-lg border border-border p-4 border-border"
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
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        placeholder="Invite code"
        className="mb-3 w-full"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={pending}
        className="rounded-md border border-input px-4 py-2 disabled:opacity-50 border-input"
      >
        {pending ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
