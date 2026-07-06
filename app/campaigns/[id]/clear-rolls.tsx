"use client";

import { useState, useTransition } from "react";
import { clearRolls } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
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
}: {
  campaignId: string;
  actors: { fid: string; name: string }[];
  sessions: { n: number; date: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [actorFid, setActorFid] = useState<string>(NONE);
  const [date, setDate] = useState<string>(NONE);
  const [result, setResult] = useState<string | null>(null);

  const actorItems = [
    { value: NONE, label: "Any character" },
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
  const nothingPicked = actorFid === NONE && date === NONE;

  return (
    <div className="rounded-md border border-destructive/40 p-3">
      <span className="font-semibold">Clear rolls</span>
      <p className="mb-2 text-muted-foreground">
        Soft-deletes matching rolls (and their messages) — stats drop them instantly, sessions
        renumber. Pick a character, a session, or both.
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
          onClick={() => {
            const what = [
              actorFid !== NONE ? actorItems.find((a) => a.value === actorFid)?.label : null,
              date !== NONE ? sessionItems.find((s) => s.value === date)?.label : null,
            ]
              .filter(Boolean)
              .join(" · ");
            if (!window.confirm(`Delete all rolls for: ${what}? This can't be undone from the UI.`))
              return;
            startTransition(async () => {
              const { cleared } = await clearRolls(campaignId, {
                actorFid: actorFid === NONE ? null : actorFid,
                date: date === NONE ? null : date,
              });
              setResult(`${cleared} message${cleared === 1 ? "" : "s"} cleared`);
            });
          }}
        >
          {pending ? "Clearing…" : "Delete matching rolls"}
        </Button>
        {result && <span className="text-muted-foreground">{result}</span>}
      </div>
    </div>
  );
}
