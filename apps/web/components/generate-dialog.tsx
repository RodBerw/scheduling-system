"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateShifts } from "@/services/shiftService";
import { toast } from "sonner";

interface GenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  scheduleId: number;
}

export function GenerateDialog({ open, onClose, onGenerated, scheduleId }: GenerateDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateShifts(scheduleId);
      const filled = res.shifts.filter((s: { assignedEmployeeId: number | null }) => s.assignedEmployeeId).length;
      const unfilled = res.shifts.length - filled;
      toast.success(`Created ${res.shifts.length} shifts (${filled} filled, ${unfilled} open)`);
      onGenerated();
      onClose();
    } catch {
      toast.error("Failed to generate schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Schedule</DialogTitle>
          <DialogDescription>
            Auto-fill shifts based on requirements and employee availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Generating..." : "Generate Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
