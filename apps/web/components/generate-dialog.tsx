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

interface GenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  scheduleId: number;
}

export function GenerateDialog({ open, onClose, onGenerated, scheduleId }: GenerateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await generateShifts(scheduleId);
      const filled = res.shifts.filter((s: { assignedEmployeeId: number | null }) => s.assignedEmployeeId).length;
      const unfilled = res.shifts.length - filled;
      setResult(`Created ${res.shifts.length} shifts (${filled} filled, ${unfilled} open)`);
      onGenerated();
    } catch {
      setResult("Failed to generate schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setResult(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Schedule</DialogTitle>
          <DialogDescription>
            Auto-fill shifts based on requirements and employee availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {result && (
            <p className={`text-sm rounded-lg p-3 ${result.includes("Failed") ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"}`}>
              {result}
            </p>
          )}

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
