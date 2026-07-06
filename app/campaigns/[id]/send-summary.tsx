"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendDiscordSummary } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_SESSIONS = 10;

// GM-only: pick up to 10 sessions, post their stat summary to the campaign's
// Discord webhook. (Phase B will hang the LLM narrative off the same picker.)
export function SendSummary({
  campaignId,
  sessions,
  webhookConfigured,
}: {
  campaignId: string;
  sessions: { n: number; date: string }[];
  webhookConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) return null;

  const toggle = (date: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else if (next.size < MAX_SESSIONS) next.add(date);
      return next;
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setStatus(null); setOpen(true); }}>
        <Send size={14} />
        Send summary to Discord
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send session summary</DialogTitle>
            <DialogDescription>
              {webhookConfigured
                ? `Pick the sessions to summarize (up to ${MAX_SESSIONS}). The stats post to your Discord channel.`
                : "No webhook set — paste a Discord webhook URL in campaign settings first (channel → Integrations → Webhooks)."}
            </DialogDescription>
          </DialogHeader>

          {webhookConfigured && (
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
              <div className="flex items-center gap-3">
                <Button
                  disabled={pending || picked.size === 0}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await sendDiscordSummary(campaignId, [...picked]);
                      setStatus(result.sent ? "Sent ✓" : (result.error ?? "Failed"));
                      if (result.sent) setPicked(new Set());
                    })
                  }
                >
                  {pending ? "Sending…" : `Send${picked.size ? ` (${picked.size})` : ""}`}
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
