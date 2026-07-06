"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActorStats, ActorTop } from "@/lib/stats";
import type { MemberInfo } from "@/lib/members";
import type { ActorKind } from "@/lib/kind";
import { AssignControl } from "./assign-control";
import { KindControl } from "./kind-control";

export type CharacterCardData = {
  actorId: string | null; // actors-table id (null if not yet discovered there)
  name: string;
  image: string;
  color: string;
  actorType: string | null;
  cr: number | null;
  kind: ActorKind;
  kindOverride: string | null;
  assignedUserId: string | null;
  stats: ActorStats | null;
  tops: ActorTop | null;
};

function crLabel(cr: number): string {
  if (cr === 0.125) return "⅛";
  if (cr === 0.25) return "¼";
  if (cr === 0.5) return "½";
  return String(cr);
}

function Avatar({ data, size }: { data: CharacterCardData; size: number }) {
  return data.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.image}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size, background: data.color, fontSize: size / 2.2 }}
      className="flex items-center justify-center rounded-full font-bold text-white"
    >
      {data.name.slice(0, 1)}
    </span>
  );
}

function KindBadges({
  data,
  isOwn,
  ownerName,
}: {
  data: CharacterCardData;
  isOwn: boolean;
  ownerName: string | null;
}) {
  return (
    <>
      {isOwn && <Badge>You</Badge>}
      {!isOwn && ownerName && <Badge variant="secondary">{ownerName}</Badge>}
      {data.kind === "pc" && !ownerName && <Badge variant="outline">Unassigned</Badge>}
      {data.kind === "monster" && <Badge variant="destructive">Monster</Badge>}
      {data.kind === "npc" && <Badge variant="secondary">NPC</Badge>}
      {data.cr !== null && <Badge variant="outline">CR {crLabel(data.cr)}</Badge>}
    </>
  );
}

function Stat({
  label,
  value,
  className,
  big,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  big?: boolean;
}) {
  return (
    <div>
      <div className={`${big ? "text-2xl" : "text-lg"} font-bold ${className ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatGrid({ s, big }: { s: ActorStats | null; big?: boolean }) {
  return (
    <div className={`grid ${big ? "grid-cols-4" : "grid-cols-3"} gap-2`}>
      <Stat big={big} label="Rolls" value={s?.allRolls ?? 0} />
      <Stat big={big} label="d20s" value={s?.d20Rolls ?? 0} />
      <Stat big={big} label="Avg d20" value={s?.avgD20?.toFixed(1) ?? "—"} />
      <Stat
        big={big}
        label="Nat 20 / 1"
        value={
          <>
            <span className="text-green-500">{s?.nat20s ?? 0}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-red-500">{s?.nat1s ?? 0}</span>
          </>
        }
      />
      <Stat big={big} label="Damage" value={s?.damage || "—"} />
      <Stat big={big} label="Healing" value={s?.healing || "—"} />
    </div>
  );
}

export function CharacterCard({
  data,
  isOwn,
  ownerName,
  members,
  canAssign,
}: {
  data: CharacterCardData;
  isOwn: boolean;
  ownerName: string | null;
  members: MemberInfo[];
  canAssign: boolean;
}) {
  const [open, setOpen] = useState(false);
  const s = data.stats;
  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className={`cursor-pointer transition-shadow hover:shadow-md ${isOwn ? "ring-2 ring-primary/40" : ""}`}
      >
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Avatar data={data} size={44} />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{data.name}</CardTitle>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <KindBadges data={data} isOwn={isOwn} ownerName={ownerName} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatGrid s={s} />
          {(data.tops?.topSkill || data.tops?.topItem) && (
            <p className="text-xs text-muted-foreground">
              {data.tops?.topSkill && (
                <>
                  Favourite skill: <span className="text-foreground">{data.tops.topSkill}</span>
                </>
              )}
              {data.tops?.topSkill && data.tops?.topItem && " · "}
              {data.tops?.topItem && (
                <>
                  Signature: <span className="text-foreground">{data.tops.topItem}</span>
                </>
              )}
            </p>
          )}
          {canAssign && data.actorId && (
            // Controls shouldn't open the modal.
            <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
              <AssignControl
                actorId={data.actorId}
                assignedUserId={data.assignedUserId}
                members={members}
              />
              <KindControl actorId={data.actorId} kindOverride={data.kindOverride} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <Avatar data={data} size={64} />
              <div>
                <DialogTitle className="text-xl">{data.name}</DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap gap-1.5">
                  <KindBadges data={data} isOwn={isOwn} ownerName={ownerName} />
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <StatGrid s={s} big />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Favourite skill</div>
                <div className="font-medium">{data.tops?.topSkill ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Signature item</div>
                <div className="font-medium">{data.tops?.topItem ?? "—"}</div>
              </div>
            </div>
            {s && s.d20Rolls > 0 && (
              <p className="text-sm text-muted-foreground">
                Nat 20 rate {((s.nat20s / s.d20Rolls) * 100).toFixed(1)}% · Nat 1 rate{" "}
                {((s.nat1s / s.d20Rolls) * 100).toFixed(1)}% · expected 5% each
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
