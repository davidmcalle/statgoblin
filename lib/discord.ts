import type { ActorStats, CampaignTotals, DeathSaveRow, ItemUsage, SessionInfo } from "@/lib/stats";

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

export type SummaryData = {
  campaignName: string;
  /** The picked sessions, oldest first. */
  sessions: SessionInfo[];
  totals: CampaignTotals;
  actorStats: ActorStats[];
  items: ItemUsage[];
  deathSaves: DeathSaveRow[];
};

const MAX_CHARACTER_FIELDS = 12;

function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** One stat embed. Discord caps: 25 fields, 6000 chars — we stay well under. */
export function buildSummaryEmbed(data: SummaryData) {
  const { campaignName, sessions, totals, actorStats, items, deathSaves } = data;

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

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  for (const s of actorStats.slice(0, MAX_CHARACTER_FIELDS)) {
    const bits = [
      `${s.allRolls} rolls`,
      s.avgD20 !== null ? `avg d20 ${s.avgD20.toFixed(1)}` : null,
      `${s.nat20s}× nat 20 / ${s.nat1s}× nat 1`,
      s.damage ? `${s.damage} dmg` : null,
      s.healing ? `${s.healing} heal` : null,
    ].filter(Boolean);
    fields.push({ name: s.actorName, value: bits.join(" · "), inline: false });
  }
  if (actorStats.length > MAX_CHARACTER_FIELDS) {
    fields.push({
      name: "…and more",
      value: `${actorStats.length - MAX_CHARACTER_FIELDS} other creatures rolled dice too.`,
    });
  }

  const notables: string[] = [];
  if (totals.highest) {
    notables.push(
      `Highest d20 total: **${totals.highest.total}** by ${totals.highest.actorName ?? "someone"}`,
    );
  }
  const luckiest = actorStats
    .filter((s) => s.d20Rolls >= 10)
    .sort((a, b) => b.nat20s / b.d20Rolls - a.nat20s / a.d20Rolls)[0];
  if (luckiest && luckiest.nat20s > 0) {
    notables.push(
      `Luckiest: **${luckiest.actorName}** (${((luckiest.nat20s / luckiest.d20Rolls) * 100).toFixed(0)}% nat 20 rate)`,
    );
  }
  const bruiser = [...actorStats].sort((a, b) => b.damage - a.damage)[0];
  if (bruiser && bruiser.damage > 0) {
    notables.push(`Most damage: **${bruiser.actorName}** (${bruiser.damage})`);
  }
  const favourite = items[0];
  if (favourite) {
    notables.push(`Most used: **${favourite.itemName}** (×${favourite.uses})`);
  }
  if (notables.length) fields.push({ name: "Notables", value: notables.join("\n") });

  if (deathSaves.length) {
    fields.push({
      name: "Death saves",
      value: deathSaves
        .slice(0, 6)
        .map((d) => {
          const flavor = d.d20 === 20 ? " — nat 20!" : d.d20 === 1 ? " — nat 1, two failures" : "";
          return `${d.actorName ?? "—"} rolled ${d.total ?? "?"}${flavor}`;
        })
        .join("\n"),
    });
  }

  return {
    title: `${campaignName} — ${sessionLabel}`,
    description: headline,
    color: 0x3fa284,
    fields,
    footer: { text: "StatGoblin" },
  };
}

export async function postWebhook(
  webhookUrl: string,
  embed: ReturnType<typeof buildSummaryEmbed>,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "StatGoblin", embeds: [embed] }),
  });
  if (!res.ok) {
    throw new Error(`Discord rejected the summary (${res.status}). Check the webhook URL.`);
  }
}
