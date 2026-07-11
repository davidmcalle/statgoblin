"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import {
  previewDiscordSummary,
  sendDiscordSummary,
  type SummaryPreview,
} from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_SESSIONS = 10;

// GM-only: pick up to 10 sessions, preview the stat summary and award cards,
// regenerate if the data changed, then send to the campaign's webhook.
export function SendSummary({
  campaignId,
  sessions,
  webhookConfigured,
  generatedKeys = [],
}: {
  campaignId: string;
  sessions: { n: number; date: string }[];
  webhookConfigured: boolean;
  /** datesKeys of already-generated summaries — previews of those are instant. */
  generatedKeys?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<SummaryPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) return null;

  const selectionKey = [...picked].sort().join(",");
  const alreadyGenerated = generatedKeys.includes(selectionKey);

  const toggle = (date: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else if (next.size < MAX_SESSIONS) next.add(date);
      return next;
    });
  };

  const generate = (regenerate: boolean) =>
    startTransition(async () => {
      setStatus(null);
      const result = await previewDiscordSummary(campaignId, [...picked], regenerate);
      if (result.ok) setPreview(result);
      else setStatus(result.error);
    });

  const reset = () => {
    setPreview(null);
    setStatus(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="rounded-md"
        title="Send session summary to Discord"
        aria-label="Send session summary to Discord"
        onClick={() => {
          reset();
          setPicked(new Set());
          setOpen(true);
        }}
      >
        <Send size={16} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview ? preview.label : "Session summary"}</DialogTitle>
            <DialogDescription>
              {preview
                ? "This is what will post to Discord. Regenerate if rolls changed since."
                : `Pick the sessions to summarize (up to ${MAX_SESSIONS}), then preview before anything is sent.`}
            </DialogDescription>
          </DialogHeader>

          {!preview && (
            <>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {sessions
                  .slice()
                  .reverse()
                  .map((s) => (
                    <li key={s.date}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm has-checked:border-primary/60 has-checked:bg-primary/5">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={picked.has(s.date)}
                          onChange={() => toggle(s.date)}
                        />
                        <span className="font-medium">Session {s.n}</span>
                        {generatedKeys.includes(s.date) && (
                          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                            generated
                          </span>
                        )}
                        <span className="ml-auto text-muted-foreground">
                          {new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={pending || picked.size === 0} onClick={() => generate(false)}>
                  {pending ? "Generating…" : alreadyGenerated ? "Preview" : "Generate Preview"}
                </Button>
                {status && <span className="text-sm text-muted-foreground">{status}</span>}
              </div>
            </>
          )}

          {preview && (
            <>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
                  <span>🎲 {preview.totals.totalRolls} rolls</span>
                  <span className="text-green-600 dark:text-green-500">
                    🍀 {preview.totals.nat20s} nat 20s
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    💀 {preview.totals.nat1s} nat 1s
                  </span>
                  {preview.totals.avgD20 !== null && (
                    <span>⚖️ avg d20 {preview.totals.avgD20.toFixed(1)}</span>
                  )}
                </div>

                {preview.notables && preview.notables.best.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Top rolls
                    </h3>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {preview.notables.best.map((n, i) => (
                        <li key={i}>
                          <span className="font-semibold text-foreground">{n.total}</span> —{" "}
                          {n.actorName}, {n.label} (d20: {n.d20})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.notables && preview.notables.worst.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Low points
                    </h3>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {preview.notables.worst.map((n, i) => (
                        <li key={i}>
                          <span className="font-semibold text-foreground">{n.total}</span> —{" "}
                          {n.actorName}, {n.label} (d20: {n.d20})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.cards.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {preview.cards.map((c) => (
                      <img
                        key={c.title}
                        src={c.dataUri}
                        alt={c.title}
                        className="w-full rounded-md border border-border"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await sendDiscordSummary(campaignId, [...picked]);
                      setStatus(result.sent ? "Sent to Discord ✓" : (result.error ?? "Failed"));
                    })
                  }
                >
                  {pending ? "Working…" : "Send to Discord"}
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => generate(true)}>
                  {pending ? "…" : "Regenerate"}
                </Button>
                <Button variant="ghost" disabled={pending} onClick={reset}>
                  Back
                </Button>
                {status && <span className="text-sm text-muted-foreground">{status}</span>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
