"use client";

import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { createCampaign } from "@/app/actions/campaigns";
import { CopyButton } from "./copy-button";

// After creation the admin API key is shown exactly once — it's never stored
// in plaintext, so the GM must copy it into Foundry now (or regenerate later).
export function CreateCampaignForm() {
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ ingestKey: string; campaignId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (created) {
    return (
      <div className="rounded-lg border border-green-300 p-4 dark:border-green-800">
        <h2 className="mb-2 font-semibold">Campaign created 🎉</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Copy these into Foundry (Configure Settings → StatGoblin). The API key is shown{" "}
          <strong>only once</strong>.
        </p>
        <dl className="space-y-2 font-mono text-xs">
          <div>
            <dt className="font-sans font-semibold">Campaign ID</dt>
            <dd className="flex items-start gap-2 rounded bg-muted p-2 bg-muted">
              <span className="break-all">{created.campaignId}</span>
              <CopyButton value={created.campaignId} label="Copy campaign ID" />
            </dd>
          </div>
          <div>
            <dt className="font-sans font-semibold">Admin API Key</dt>
            <dd className="flex items-start gap-2 rounded bg-muted p-2 bg-muted">
              <span className="break-all">{created.ingestKey}</span>
              <CopyButton value={created.ingestKey} label="Copy API key" />
            </dd>
          </div>
        </dl>
        <a href={`/campaigns/${created.campaignId}`} className="mt-3 inline-block underline">
          Go to campaign →
        </a>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-border p-4 border-border"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            setCreated(await createCampaign(formData));
          } catch {
            setError("Could not create campaign.");
          }
        });
      }}
    >
      <h2 className="mb-2 font-semibold">Create a campaign</h2>
      <Input
        name="name"
        required
        maxLength={80}
        placeholder="Campaign name"
        className="mb-3 w-full"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
