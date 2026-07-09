"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import {
  generateSummaryAudio,
  getSummaryAudio,
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

// GM-only: pick up to 10 sessions, preview the generated recap (narrative,
// highlights, award cards), regenerate if it's not right, then send.
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
  const [audio, setAudio] = useState<string | null>(null);
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
      setAudio(null);
      const result = await previewDiscordSummary(campaignId, [...picked], regenerate);
      if (result.ok) {
        setPreview(result);
        if (result.hasAudio && !regenerate) {
          const existing = await getSummaryAudio(campaignId, [...picked]);
          if (existing) setAudio(existing.dataUri);
        }
      } else setStatus(result.error);
    });

  const reset = () => {
    setPreview(null);
    setAudio(null);
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
                ? "This is what will post to Discord. Regenerate if it's not right."
                : `Pick the sessions to recap (up to ${MAX_SESSIONS}), then preview before anything is sent.`}
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
                  {pending
                    ? "Generating…"
                    : alreadyGenerated
                      ? "Preview"
                      : "Generate Preview"}
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

                {preview.dialogue.length > 0 ? (
                  <div className="space-y-2 border-l-2 border-border pl-3 text-foreground">
                    {preview.dialogue.map((l, i) => (
                      <p key={i}>
                        <span
                          className={
                            l.speaker === "zog"
                              ? "font-bold text-green-700 dark:text-green-500"
                              : "font-bold text-sky-700 dark:text-sky-400"
                          }
                        >
                          {l.speaker === "zog" ? "Zog" : "Zaela"}:
                        </span>{" "}
                        {l.line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {preview.llmConfigured
                      ? "No recap in this version — it was generated before the API key was set, or the generation failed (check server logs). Hit Regenerate."
                      : "No recap — the app has no Anthropic API key configured, so this will post as plain stats."}
                  </p>
                )}

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

                {preview.highlights.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Highlights
                    </h3>
                    <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                      {preview.highlights.map((h, i) => (
                        <li key={i}>
                          <span className="font-semibold text-foreground">
                            {h.speaker === "zog" ? "Zog" : "Zaela"}:
                          </span>{" "}
                          {h.line}
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

                {preview.dialogue.length > 0 && preview.ttsConfigured && (
                  <div className="space-y-2">
                    <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Voice recap
                    </h3>
                    {audio ? (
                      <audio controls src={audio} className="w-full" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await generateSummaryAudio(campaignId, [...picked]);
                            if (result.ok) setAudio(result.dataUri);
                            else setStatus(result.error);
                          })
                        }
                      >
                        {pending ? "Voicing…" : "Generate Voice"}
                      </Button>
                    )}
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
