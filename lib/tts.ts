import type { DialogueLine } from "@/lib/summary";

// Voice recaps via ElevenLabs Text-to-Dialogue: the whole speaker-tagged
// script goes up in one request and comes back as a single mp3 with the
// turn-taking and pacing handled by the model — no clip stitching.
//
// Env:
//   ELEVENLABS_API_KEY    — from the ElevenLabs dashboard
//   ELEVENLABS_VOICE_ZOG  — voice id for Zog (make one with Voice Design:
//                           "gravelly drunk cockney goblin, slurring, gleeful")
//   ELEVENLABS_VOICE_ZAELA — voice id for Zaela ("warm melodic elf,
//                           gently exasperated, kind")

export function ttsConfigured(): boolean {
  return !!(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_VOICE_ZOG &&
    process.env.ELEVENLABS_VOICE_ZAELA
  );
}

export async function generateDialogueAudio(dialogue: DialogueLine[]): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  const voices = {
    zog: process.env.ELEVENLABS_VOICE_ZOG,
    zaela: process.env.ELEVENLABS_VOICE_ZAELA,
  };
  if (!key || !voices.zog || !voices.zaela) {
    throw new Error("ElevenLabs is not configured (key + two voice ids required)");
  }

  // ElevenLabs clamps speed to 0.7–1.2; Zog rattles along at the ceiling,
  // Zaela a touch slower so the contrast survives.
  const speed = { zog: 1.2, zaela: 1.1 } as const;

  const res = await fetch("https://api.elevenlabs.io/v1/text-to-dialogue", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "eleven_v3",
      inputs: dialogue.map((l) => ({
        text: l.line,
        voice_id: voices[l.speaker],
        voice_settings: { speed: speed[l.speaker] },
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs rejected the dialogue (${res.status}): ${detail.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
