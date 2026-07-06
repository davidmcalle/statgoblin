"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteRoll } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

// Soft-deletes the roll's whole message (attack + damage together).
export function DeleteRollButton({ rollId }: { rollId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        title="Delete this roll (its whole message)"
        aria-label="Delete roll"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this roll?"
        description="Its whole message goes with it — an attack's damage rolls included. Stats update instantly."
        confirmLabel="Delete roll"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            await deleteRoll(rollId);
            setOpen(false);
          })
        }
      />
    </>
  );
}
