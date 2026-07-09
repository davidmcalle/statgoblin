"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { devVoiceTest } from "./actions";

// UAT harness for the voice pipeline: fires a fixed Zog & Zaela exchange at
// ElevenLabs and plays the result. Judge the voices here before wiring them
// into real recaps.
export function VoiceTest() {
  const [audio, setAudio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div>
        <h2 className="text-lg font-semibold">Voice test</h2>
        <p className="text-sm text-muted-foreground">
          Voices a fixed Zog &amp; Zaela exchange through ElevenLabs text-to-dialogue. Costs a
          few credits per run.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await devVoiceTest();
              if (result.ok) setAudio(result.dataUri);
              else setError(result.error);
            })
          }
        >
          {pending ? "Voicing…" : "Run voice test"}
        </Button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
      {audio && <audio controls src={audio} className="w-full max-w-md" />}
    </section>
  );
}
