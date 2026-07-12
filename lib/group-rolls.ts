// Group rolls: when the party all make the same check in a short burst — a
// perception sweep, a stealth escape, a round of insight — that's one shared
// moment. This analyzer clusters same-check d20 rolls that land within a
// window of each other and surfaces the party's spread, average, and the
// advantage/disadvantage picture. Pure and dependency-free so the live DB
// path and the UAT fixtures run identical logic.

/** The d20-check roll types that can form a group (everyone rolls the same). */
export const GROUP_CHECK_TYPES = ["skill", "ability", "save", "concentration"] as const;
const CHECK_SET = new Set<string>(GROUP_CHECK_TYPES);

const DEFAULT_WINDOW_MS = 90_000;
const DEFAULT_MIN_PARTICIPANTS = 2;

/** Minimal per-roll shape the analyzer needs — a subset of a Roll row. */
export type GroupRollRow = {
  rolledAt: Date;
  actorFid: string | null;
  actorName: string | null;
  rollType: string;
  skill: string | null;
  ability: string | null;
  d20: number | null;
  total: number | null;
  advantageState: number | null;
  isNat20: boolean;
  isNat1: boolean;
  sessionDate: Date;
};

export type GroupParticipant = {
  actorName: string;
  d20: number | null;
  total: number | null;
  /** -1 disadvantage, 0 normal, 1 advantage. */
  advantageState: number | null;
  isNat20: boolean;
  isNat1: boolean;
};

export type GroupRoll = {
  rollType: string;
  /** Skill id when the check named one, else null (bare ability / save). */
  skill: string | null;
  ability: string | null;
  /** First roll in the burst. */
  rolledAt: Date;
  sessionDate: Date;
  /** Seconds between the first and last roll in the burst. */
  spanSec: number;
  participants: GroupParticipant[];
  /** Mean of the participants' d20 faces — the "how did the party do" number. */
  avgD20: number | null;
  /** Mean of the participants' final totals (the group roll result). */
  avgTotal: number | null;
  doubleNat20: boolean;
  doubleNat1: boolean;
  advCount: number;
  disCount: number;
};

export type AdvantageBucket = { n: number; avgD20: number | null };

export type AdvantageSummary = {
  adv: AdvantageBucket;
  normal: AdvantageBucket;
  dis: AdvantageBucket;
};

export type GroupRollReport = {
  summary: AdvantageSummary;
  groups: GroupRoll[];
  /** Groups with two or more natural 20s / natural 1s in the same burst. */
  doubleNat20Groups: number;
  doubleNat1Groups: number;
};

const avg = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

function buildGroup(cluster: GroupRollRow[]): GroupRoll {
  const participants: GroupParticipant[] = cluster.map((r) => ({
    actorName: r.actorName ?? "—",
    d20: r.d20,
    total: r.total,
    advantageState: r.advantageState,
    isNat20: r.isNat20,
    isNat1: r.isNat1,
  }));
  const d20s = participants.map((p) => p.d20).filter((x): x is number => x != null);
  const totals = participants.map((p) => p.total).filter((x): x is number => x != null);
  const first = cluster[0];
  const last = cluster[cluster.length - 1];
  return {
    rollType: first.rollType,
    skill: first.skill,
    ability: first.ability,
    rolledAt: first.rolledAt,
    sessionDate: first.sessionDate,
    spanSec: Math.round((last.rolledAt.getTime() - first.rolledAt.getTime()) / 1000),
    participants,
    avgD20: avg(d20s),
    avgTotal: avg(totals),
    doubleNat20: participants.filter((p) => p.isNat20).length >= 2,
    doubleNat1: participants.filter((p) => p.isNat1).length >= 2,
    advCount: participants.filter((p) => p.advantageState === 1).length,
    disCount: participants.filter((p) => p.advantageState === -1).length,
  };
}

export function analyzeGroupRolls(
  rows: GroupRollRow[],
  opts: { windowMs?: number; minParticipants?: number } = {},
): GroupRollReport {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const minParticipants = opts.minParticipants ?? DEFAULT_MIN_PARTICIPANTS;
  const checks = rows.filter((r) => r.d20 != null && CHECK_SET.has(r.rollType));

  // Advantage summary over every check (not just grouped ones).
  const buckets = {
    adv: { sum: 0, n: 0 },
    normal: { sum: 0, n: 0 },
    dis: { sum: 0, n: 0 },
  };
  for (const r of checks) {
    const b =
      r.advantageState === 1 ? buckets.adv : r.advantageState === -1 ? buckets.dis : buckets.normal;
    b.sum += r.d20 as number;
    b.n += 1;
  }
  const mk = (b: { sum: number; n: number }): AdvantageBucket => ({
    n: b.n,
    avgD20: b.n ? Math.round((b.sum / b.n) * 10) / 10 : null,
  });
  const summary: AdvantageSummary = {
    adv: mk(buckets.adv),
    normal: mk(buckets.normal),
    dis: mk(buckets.dis),
  };

  // Cluster within each check identity by time gap.
  const byKey = new Map<string, GroupRollRow[]>();
  for (const r of checks) {
    const key = `${r.rollType}|${r.skill ?? r.ability ?? "?"}`;
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }

  const groups: GroupRoll[] = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => a.rolledAt.getTime() - b.rolledAt.getTime());
    let cluster: GroupRollRow[] = [];
    const flush = () => {
      const distinct = new Set(cluster.map((r) => r.actorFid ?? r.actorName));
      if (cluster.length && distinct.size >= minParticipants) groups.push(buildGroup(cluster));
      cluster = [];
    };
    for (const r of list) {
      const prev = cluster[cluster.length - 1];
      if (prev && r.rolledAt.getTime() - prev.rolledAt.getTime() > windowMs) flush();
      cluster.push(r);
    }
    flush();
  }
  groups.sort((a, b) => b.rolledAt.getTime() - a.rolledAt.getTime());

  return {
    summary,
    groups,
    doubleNat20Groups: groups.filter((g) => g.doubleNat20).length,
    doubleNat1Groups: groups.filter((g) => g.doubleNat1).length,
  };
}
