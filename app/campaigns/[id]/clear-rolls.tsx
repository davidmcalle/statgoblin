"use client";

import { useState, useTransition } from "react";
import { clearRolls } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

// GM danger zone: bulk soft-delete rolls by character, session date, or both.
export function ClearRolls({
  campaignId,
  actors,
  sessions,
  isCreator = false,
}: {
  campaignId: string;
  actors: { fid: string; name: string }[];
  sessions: { n: number; date: string }[];
  isCreator?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Players start on their (usually only) character; the GM starts on "any".
  const [actorFid, setActorFid] = useState<string>(() =>
    !isCreator && actors[0] ? actors[0].fid : NONE,
  );
  const [date, setDate] = useState<string>(NONE);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Players must pick one of their own characters; only the GM gets "any".
  const actorItems = [
    ...(isCreator ? [{ value: NONE, label: "Any character" }] : []),
    ...actors.map((a) => ({ value: a.fid, label: a.name })),
  ];
  const sessionItems = [
    { value: NONE, label: "Any session" },
    ...sessions
      .slice()
      .reverse()
      .map((s) => ({
        value: s.date,
        label: `Session ${s.n} — ${new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      })),
  ];
  const nothingPicked = isCreator ? actorFid === NONE && date === NONE : actorFid === NONE;
  if (actors.length === 0 && !isCreator) return null;

  return (
    <div className="rounded-md border border-destructive/40 p-3">
      <span className="font-semibold">Clear rolls</span>
      <p className="mb-2 text-muted-foreground">
        Soft-deletes matching rolls (and their messages) — stats drop them instantly, sessions
        renumber. {isCreator ? "Pick a character, a session, or both." : "Pick one of your characters (and optionally a session)."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select items={actorItems} value={actorFid} onValueChange={(v) => setActorFid(v ?? NONE)}>
          <SelectTrigger className="w-44" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actorItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={sessionItems} value={date} onValueChange={(v) => setDate(v ?? NONE)}>
          <SelectTrigger className="w-44" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sessionItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || nothingPicked}
          onClick={() => setConfirming(true)}
        >
          {pending ? "Clearing…" : "Delete matching rolls"}
        </Button>
        {result && <span className="text-muted-foreground">{result}</span>}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete matching rolls?"
        description={`All rolls for ${
          [
            actorFid !== NONE ? actorItems.find((a) => a.value === actorFid)?.label : null,
            date !== NONE ? sessionItems.find((s) => s.value === date)?.label : null,
          ]
            .filter(Boolean)
            .join(" · ") || "this selection"
        } will be removed. This can't be undone from the UI.`}
        confirmLabel="Delete rolls"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const { cleared } = await clearRolls(campaignId, {
              actorFid: actorFid === NONE ? null : actorFid,
              date: date === NONE ? null : date,
            });
            setResult(`${cleared} message${cleared === 1 ? "" : "s"} cleared`);
            setConfirming(false);
          })
        }
      />
    </div>
  );
}
