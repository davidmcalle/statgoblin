"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteRoll } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

// GM-only: soft-deletes the roll's whole message (attack + damage together).
export function DeleteRollButton({ rollId }: { rollId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title="Delete this roll (its whole message)"
      aria-label="Delete roll"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (window.confirm("Delete this roll? Its whole message (e.g. attack + damage) goes with it.")) {
          startTransition(() => deleteRoll(rollId));
        }
      }}
    >
      <Trash2 size={15} />
    </Button>
  );
}
