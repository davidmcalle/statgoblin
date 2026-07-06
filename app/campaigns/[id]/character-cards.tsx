import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActorStats, ActorTop } from "@/lib/stats";
import type { MemberInfo } from "@/lib/members";
import { AssignControl } from "./assign-control";

export type CharacterCardData = {
  actorId: string | null; // actors-table id (null if not yet discovered there)
  name: string;
  image: string;
  color: string;
  actorType: string | null;
  cr: number | null;
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

function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${className ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
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
  const s = data.stats;
  return (
    <Card className={isOwn ? "ring-2 ring-primary/40" : undefined}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        {data.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: data.color }}
          >
            {data.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">{data.name}</CardTitle>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {isOwn && <Badge>You</Badge>}
            {!isOwn && ownerName && <Badge variant="secondary">{ownerName}</Badge>}
            {!ownerName && data.actorType !== "npc" && (
              <Badge variant="outline">Unassigned</Badge>
            )}
            {data.actorType === "npc" && <Badge variant="destructive">Monster</Badge>}
            {data.cr !== null && <Badge variant="outline">CR {crLabel(data.cr)}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Rolls" value={s?.allRolls ?? 0} />
          <Stat label="Avg d20" value={s?.avgD20?.toFixed(1) ?? "—"} />
          <Stat
            label="Nat 20 / 1"
            value={
              <>
                <span className="text-green-500">{s?.nat20s ?? 0}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-red-500">{s?.nat1s ?? 0}</span>
              </>
            }
          />
          <Stat label="Damage" value={s?.damage || "—"} />
          <Stat label="Healing" value={s?.healing || "—"} />
        </div>
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
          <AssignControl
            actorId={data.actorId}
            assignedUserId={data.assignedUserId}
            members={members}
          />
        )}
      </CardContent>
    </Card>
  );
}
