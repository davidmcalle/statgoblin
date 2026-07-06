"use client";

import { useTransition } from "react";
import { setActorKind } from "@/app/actions/campaigns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AUTO = "__auto__";

const ITEMS = [
  { value: AUTO, label: "Auto" },
  { value: "pc", label: "Player character" },
  { value: "npc", label: "NPC" },
  { value: "monster", label: "Monster" },
];

// GM-only kind tag; Auto = derive from assignment/actor type.
export function KindControl({
  actorId,
  kindOverride,
}: {
  actorId: string;
  kindOverride: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      items={ITEMS}
      value={kindOverride ?? AUTO}
      onValueChange={(v) =>
        startTransition(() => setActorKind(actorId, v === AUTO || v === null ? null : v))
      }
      disabled={pending}
    >
      <SelectTrigger className="h-7 w-full text-xs" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
