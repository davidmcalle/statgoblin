"use client";

import { useState, useTransition } from "react";
import { createApiKey, deleteApiKey, updateCampaign } from "@/app/actions/campaigns";
import { CopyButton } from "@/app/_components/copy-button";

type Campaign = { id: string; name: string; image: string; inviteCode: string };

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

// Creator-only panel: edit name/image, share the invite link, show the Foundry
// campaign UUID, manage API keys. Key plaintext appears only in the response of
// a create — never stored, never shown again.
export function CampaignSettings({
  campaign,
  apiKeys,
}: {
  campaign: Campaign;
  apiKeys: ApiKeyRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
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

      <div className="mt-6 space-y-4 text-sm">
        <div>
          <span className="font-semibold">Invite link</span>
          <p className="flex items-start gap-2 rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
            <span className="break-all">{inviteLink || `/join/${campaign.inviteCode}`}</span>
            <CopyButton value={inviteLink || `/join/${campaign.inviteCode}`} label="Copy invite link" />
          </p>
        </div>
        <div>
          <span className="font-semibold">Foundry: Campaign ID</span>
          <p className="flex items-start gap-2 rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
            <span className="break-all">{campaign.id}</span>
            <CopyButton value={campaign.id} label="Copy campaign ID" />
          </p>
        </div>

        <div>
          <span className="font-semibold">API keys</span>
          <p className="mb-2 text-gray-500">
            Any live key authorizes ingest for this campaign. Plaintext is shown once at creation.
          </p>
          {freshKey && (
            <div className="mb-3 rounded border border-green-300 p-2 dark:border-green-800">
              <p className="mb-1 font-semibold">New key — copy it now, it won&apos;t be shown again:</p>
              <p className="flex items-start gap-2 rounded bg-gray-100 p-2 font-mono text-xs dark:bg-gray-900">
                <span className="break-all">{freshKey}</span>
                <CopyButton value={freshKey} label="Copy API key" />
              </p>
            </div>
          )}
          <ul className="mb-3 space-y-1">
            {apiKeys.length === 0 && (
              <li className="text-gray-500">No keys — Foundry can&apos;t send rolls until you create one.</li>
            )}
            {apiKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <span className="font-semibold">{k.name}</span>
                <span className="font-mono text-xs text-gray-500">{k.keyPrefix}</span>
                <span className="text-xs text-gray-500">
                  created {k.createdAt.slice(0, 10)} · last used{" "}
                  {k.lastUsedAt ? k.lastUsedAt.slice(0, 16).replace("T", " ") : "never"}
                </span>
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => deleteApiKey(k.id))}
                  className="ml-auto rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 disabled:opacity-50 dark:border-red-800"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            action={(formData) => {
              startTransition(async () => {
                const { ingestKey } = await createApiKey(campaign.id, formData);
                setFreshKey(ingestKey);
                setKeyName("");
              });
            }}
          >
            <input
              name="name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
              maxLength={80}
              placeholder="Key name (e.g. Foundry)"
              className="flex-1 rounded border border-gray-300 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              disabled={pending}
              className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-700"
            >
              Create key
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
