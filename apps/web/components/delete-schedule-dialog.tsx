"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface DeleteScheduleDialogProps {
  scheduleName: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteScheduleDialog({ scheduleName, isPending, onConfirm, onCancel }: DeleteScheduleDialogProps) {
  return (
    <Dialog open={!!scheduleName} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Schedule
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{scheduleName}&rdquo;? This will remove all shifts and requirements. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isPending} className="cursor-pointer">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending} className="cursor-pointer">
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
