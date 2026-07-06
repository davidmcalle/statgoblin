"use client";

import { useState, useTransition } from "react";
import { regenerateIngestKey, updateCampaign } from "@/app/actions/campaigns";

type Campaign = { id: string; name: string; image: string; inviteCode: string };

// Creator-only panel: edit name/image, share the invite link, show the
// Foundry credentials (campaign UUID always; API key only fresh from a
// regenerate — plaintext is never stored).
export function CampaignSettings({ campaign }: { campaign: Campaign }) {
  const [pending, startTransition] = useTransition();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const inviteLink =
    typeof window === "undefined" ? "" : `${window.location.origin}/join/${campaign.inviteCode}`;

  return (
    <details className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <summary className="cursor-pointer font-semibold">Campaign settings (GM only)</summary>

      <form
        className="mt-4 space-y-3"
        action={(formData) => {
          setSaved(false);
          startTransition(async () => {
            await updateCampaign(campaign.id, formData);
            setSaved(true);
          });
        }}
      >
        <label className="block">
          <span className="text-sm font-semibold">Name</span>
          <input
            name="name"
            defaultValue={campaign.name}
            required
            maxLength={80}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Image URL</span>
          <input
            name="image"
            defaultValue={campaign.image}
            placeholder="https://…"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-sm">
        <div>
          <span className="font-semibold">Invite link</span>
          <p className="break-all rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
            {inviteLink || `/join/${campaign.inviteCode}`}
          </p>
        </div>
        <div>
          <span className="font-semibold">Foundry: Campaign ID</span>
          <p className="break-all rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
            {campaign.id}
          </p>
        </div>
        <div>
          <span className="font-semibold">Foundry: Admin API Key</span>
          {freshKey ? (
            <p className="break-all rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
              {freshKey}
            </p>
          ) : (
            <p className="text-gray-500">
              Stored hashed — not viewable. Regenerate to get a new one.
            </p>
          )}
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const { ingestKey } = await regenerateIngestKey(campaign.id);
                setFreshKey(ingestKey);
              })
            }
            className="mt-1 rounded-md border border-red-300 px-3 py-1 text-red-600 disabled:opacity-50 dark:border-red-800"
          >
            Regenerate key (invalidates the old one)
          </button>
        </div>
      </div>
    </details>
  );
}
