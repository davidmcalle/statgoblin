import type { SummaryPayload } from "@/lib/summary";

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
  files: { name: string; data: Buffer }[] = [],
): Promise<void> {
  let res: Response;
  if (files.length === 0) {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "StatGoblin", embeds }),
    });
  } else {
    // Attachments ride multipart; Discord tiles multiple images as a gallery.
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ username: "StatGoblin", embeds }));
    files.forEach((f, i) => {
      form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)], { type: "image/png" }), f.name);
    });
    res = await fetch(webhookUrl, { method: "POST", body: form });
  }
  if (!res.ok) {
    throw new Error(`Discord rejected the summary (${res.status}). Check the webhook URL.`);
  }
}

/** Only public URLs work as Discord thumbnails; Foundry paths are relative. */
function publicUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

const EMBED_COLOR = 0x3fa284;

export function sessionLabelOf(sessions: { n: number; date: string }[]): string {
  return sessions.length === 1
    ? `Session ${sessions[0].n} — ${fmtDate(sessions[0].date)}`
    : `Sessions ${sessions.map((s) => s.n).join(", ")}`;
}

/**
 * The header embed: campaign image, session label, headline stats and the
 * session's notable rolls. Award cards travel separately as image
 * attachments (text composed onto the art).
 */
export function buildSummaryHeaderEmbed(
  campaignName: string,
  campaignImage: string,
  payload: SummaryPayload,
): object {
  const { sessions, totals, notables } = payload;

  const headline = [
    `🎲 **${totals.totalRolls}** rolls`,
    `🍀 **${totals.nat20s}** nat 20s`,
    `💀 **${totals.nat1s}** nat 1s`,
    totals.avgD20 !== null ? `⚖️ avg d20 **${totals.avgD20.toFixed(1)}**` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const header: Record<string, unknown> = {
    title: `${campaignName} — ${sessionLabelOf(sessions)}`,
    description: headline,
    color: EMBED_COLOR,
    footer: { text: "StatGoblin" },
  };

  const fields: { name: string; value: string }[] = [];
  if (notables?.best.length) {
    const lines = notables.best.map(
      (n) => `**${n.total}** — ${n.actorName}, ${n.label} (d20: ${n.d20})`,
    );
    if (notables.biggestHit) {
      const h = notables.biggestHit;
      lines.push(`**${h.damage} damage** — ${h.actorName}${h.itemName ? `, ${h.itemName}` : ""}`);
    }
    fields.push({ name: "Top rolls", value: lines.join("\n").slice(0, 1024) });
  }
  if (notables?.worst.length) {
    fields.push({
      name: "Low points",
      value: notables.worst
        .map((n) => `**${n.total}** — ${n.actorName}, ${n.label} (d20: ${n.d20})`)
        .join("\n")
        .slice(0, 1024),
    });
  }
  if (fields.length) header.fields = fields;

  const image = publicUrl(campaignImage);
  if (image) header.thumbnail = { url: image };
  return header;
}
