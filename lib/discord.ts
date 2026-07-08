// Discord webhook plumbing for "Send summary". Plain fetch against the
// campaign's webhook URL — no bot, no OAuth; the GM mints the webhook in
// their own server and pastes it into settings.

const WEBHOOK_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

export function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      WEBHOOK_HOSTS.includes(u.hostname) &&
      u.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export async function postWebhook(
  webhookUrl: string,
  embeds: object[],
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "StatGoblin", embeds }),
  });
  if (!res.ok) {
    throw new Error(`Discord rejected the summary (${res.status}). Check the webhook URL.`);
  }
}

/** Only public URLs work as Discord thumbnails; Foundry paths are relative. */
function publicUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

const EMBED_COLOR = 0x3fa284;

/**
 * The generated-summary message: one header embed (campaign image, session
 * label, narrative, headline stats) plus one small embed per award carrying
 * the character's portrait and the LLM's commentary. Discord caps a message
 * at 10 embeds — header + up to 9 awards.
 */
export function buildGeneratedSummaryEmbeds(
  campaignName: string,
  campaignImage: string,
  payload: {
    sessions: { n: number; date: string }[];
    totals: { totalRolls: number; nat20s: number; nat1s: number; avgD20: number | null };
    awards: { title: string; actorName: string; statLine: string; comment?: string }[];
    narrative: string | null;
    highlights?: string[];
  },
  actorImages: Map<string, string>,
): object[] {
  const { sessions, totals, awards, narrative, highlights } = payload;
  const sessionLabel =
    sessions.length === 1
      ? `Session ${sessions[0].n} — ${fmtDate(sessions[0].date)}`
      : `Sessions ${sessions.map((s) => s.n).join(", ")}`;

  const headline = [
    `🎲 **${totals.totalRolls}** rolls`,
    `🍀 **${totals.nat20s}** nat 20s`,
    `💀 **${totals.nat1s}** nat 1s`,
    totals.avgD20 !== null ? `⚖️ avg d20 **${totals.avgD20.toFixed(1)}**` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const header: Record<string, unknown> = {
    title: `${campaignName} — ${sessionLabel}`,
    description: [narrative, headline].filter(Boolean).join("\n\n").slice(0, 4000),
    color: EMBED_COLOR,
    footer: { text: "StatGoblin" },
  };
  if (highlights?.length) {
    header.fields = [
      { name: "Highlights", value: highlights.map((h) => `• ${h}`).join("\n").slice(0, 1024) },
    ];
  }
  const image = publicUrl(campaignImage);
  if (image) header.thumbnail = { url: image };

  const awardEmbeds = awards.slice(0, 9).map((a) => {
    const embed: Record<string, unknown> = {
      author: { name: `${a.title} — ${a.actorName}` },
      description: [a.comment, `*${a.statLine}*`].filter(Boolean).join("\n"),
      color: EMBED_COLOR,
    };
    const portrait = publicUrl(actorImages.get(a.actorName));
    if (portrait) embed.thumbnail = { url: portrait };
    return embed;
  });

  return [header, ...awardEmbeds];
}
