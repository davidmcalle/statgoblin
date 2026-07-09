"use server";

import { generateDialogueAudio, ttsConfigured } from "@/lib/tts";
import type { DialogueLine } from "@/lib/summary";

// Dev-only: voice a fixture Zog & Zaela exchange so the ElevenLabs pipeline
// (voices, pacing, register) can be judged without touching a real campaign.

const FIXTURE: DialogueLine[] = [
  { speaker: "zog", line: "Right, listen up you sorry lot — another shitshow from Maeple, useless as always." },
  { speaker: "zaela", line: "Hey now Zog! She's not that bad, you miserable sod — did you not see the damage she did? Much better than last week." },
  { speaker: "zog", line: "One decent hit with that posh rapier and suddenly she's a legend, is she? The spider out-rolled the whole bleeding party." },
  { speaker: "zaela", line: "And yet the spider's the one that ended up dead, dear. Funny how that works." },
];

export async function devVoiceTest(): Promise<
  { ok: true; dataUri: string } | { ok: false; error: string }
> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "dev only" };
  }
  if (!ttsConfigured()) {
    return {
      ok: false,
      error:
        "ElevenLabs not configured — set ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ZOG and ELEVENLABS_VOICE_ZAELA in .env, then restart the dev server.",
    };
  }
  try {
    const audio = await generateDialogueAudio(FIXTURE);
    return { ok: true, dataUri: `data:audio/mpeg;base64,${audio.toString("base64")}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "voice test failed" };
  }
}
