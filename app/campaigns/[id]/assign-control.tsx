"use client";

import { useTransition } from "react";
import { assignActor } from "@/app/actions/campaigns";
import type { MemberInfo } from "@/lib/members";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

// GM-only: link this actor to a player. "GM / monster" clears the link.
export function AssignControl({
  actorId,
  assignedUserId,
  members,
}: {
  actorId: string;
  assignedUserId: string | null;
  members: MemberInfo[];
}) {
  const [pending, startTransition] = useTransition();
  const items = [
    { value: NONE, label: "GM / monster" },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
  ];
  return (
    <Select
      items={items}
      value={assignedUserId ?? NONE}
      onValueChange={(v) =>
        startTransition(() => assignActor(actorId, v === NONE || v === null ? null : v))
      }
      disabled={pending}
    >
      <SelectTrigger className="h-7 w-full text-xs" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
