"use client";

import { Input } from "@/components/ui/input";
import { useEffect, useState, useTransition } from "react";
import {
  createApiKey,
  deleteApiKey,
  removeMember,
  setHideDeathSaves,
  updateCampaign,
} from "@/app/actions/campaigns";
import { CopyButton } from "@/app/_components/copy-button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MemberInfo } from "@/lib/members";

type Campaign = {
  id: string;
  name: string;
  image: string;
  inviteCode: string;
  hideDeathSaves: boolean;
};

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
  members = [],
}: {
  campaign: Campaign;
  apiKeys: ApiKeyRow[];
  members?: MemberInfo[];
}) {
  const [pending, startTransition] = useTransition();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<MemberInfo | null>(null);

  // Origin only exists in the browser; render the relative link during SSR and
  // upgrade after mount so server and client HTML match.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteLink = `${origin}/join/${campaign.inviteCode}`;

  return (
    <details className="rounded-lg border border-border p-4 border-border">
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
          <Input
            name="name"
            defaultValue={campaign.name}
            required
            maxLength={80}
            className="mt-1 w-full"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Image URL</span>
          <Input
            name="image"
            defaultValue={campaign.image}
            placeholder="https://…"
            className="mt-1 w-full"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>

      <div className="mt-6 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <span className="font-semibold">Hide death saves</span>
            <p className="text-muted-foreground">
              While on, new death saves are visible only to you. Turning it off reveals the
              currently hidden ones permanently — re-enabling won&apos;t re-hide them.
            </p>
          </div>
          <Switch
            checked={campaign.hideDeathSaves}
            disabled={pending}
            onCheckedChange={(checked) =>
              startTransition(() => setHideDeathSaves(campaign.id, !!checked))
            }
          />
        </div>
        <div>
          <span className="font-semibold">Invite link</span>
          <p className="flex items-start gap-2 rounded bg-muted p-2 font-mono text-xs bg-muted">
            <span className="break-all">{inviteLink || `/join/${campaign.inviteCode}`}</span>
            <CopyButton value={inviteLink || `/join/${campaign.inviteCode}`} label="Copy invite link" />
          </p>
        </div>
        <div>
          <span className="font-semibold">Foundry: Campaign ID</span>
          <p className="flex items-start gap-2 rounded bg-muted p-2 font-mono text-xs bg-muted">
            <span className="break-all">{campaign.id}</span>
            <CopyButton value={campaign.id} label="Copy campaign ID" />
          </p>
        </div>

        {members.length > 0 && (
          <div>
            <span className="font-semibold">Members</span>
            <p className="mb-2 text-muted-foreground">
              Removing a player unassigns their characters and revokes their access. Their rolls
              stay with the campaign.
            </p>
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-2"
                >
                  <span className="font-semibold">{m.name}</span>
                  <Badge variant={m.role === "gm" ? "default" : "secondary"}>
                    {m.role === "gm" ? "GM" : "Player"}
                  </Badge>
                  {m.role !== "gm" && (
                    <button
                      disabled={pending}
                      onClick={() => setRemoving(m)}
                      className="ml-auto rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 disabled:opacity-50 dark:border-red-800"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <ConfirmDialog
              open={removing !== null}
              onOpenChange={(open) => !open && setRemoving(null)}
              title={`Remove ${removing?.name ?? "this player"}?`}
              description="Their characters return to the unassigned bucket and they lose access to the campaign. Their rolls stay."
              confirmLabel="Remove player"
              pending={pending}
              onConfirm={() => {
                const target = removing;
                if (!target) return;
                startTransition(async () => {
                  await removeMember(campaign.id, target.userId);
                  setRemoving(null);
                });
              }}
            />
          </div>
        )}

        <div>
          <span className="font-semibold">API keys</span>
          <p className="mb-2 text-muted-foreground">
            Any live key authorizes ingest for this campaign. Plaintext is shown once at creation.
          </p>
          {freshKey && (
            <div className="mb-3 rounded border border-green-300 p-2 dark:border-green-800">
              <p className="mb-1 font-semibold">New key — copy it now, it won&apos;t be shown again:</p>
              <p className="flex items-start gap-2 rounded bg-muted p-2 font-mono text-xs bg-muted">
                <span className="break-all">{freshKey}</span>
                <CopyButton value={freshKey} label="Copy API key" />
              </p>
            </div>
          )}
          <ul className="mb-3 space-y-1">
            {apiKeys.length === 0 && (
              <li className="text-muted-foreground">No keys — Foundry can&apos;t send rolls until you create one.</li>
            )}
            {apiKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-2 border-border"
              >
                <span className="font-semibold">{k.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</span>
                <span className="text-xs text-muted-foreground">
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
            <Input
              name="name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
              maxLength={80}
              placeholder="Key name (e.g. Foundry)"
              className="flex-1"
            />
            <button
              disabled={pending}
              className="rounded-md border border-input px-3 py-1.5 disabled:opacity-50 border-input"
            >
              Create key
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
