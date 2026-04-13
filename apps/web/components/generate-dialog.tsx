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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateSchedule } from "@/lib/api";

interface GenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  defaultStart: string;
  defaultEnd: string;
}

export function GenerateDialog({ open, onClose, onGenerated, defaultStart, defaultEnd }: GenerateDialogProps) {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await generateSchedule(startDate, endDate);
      const filled = res.shifts.filter((s) => s.assignedEmployeeId).length;
      const unfilled = res.shifts.length - filled;
      setResult(`Created ${res.shifts.length} shifts (${filled} filled, ${unfilled} open)`);
      onGenerated();
    } catch {
      setResult("Failed to generate schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const setQuickRange = (label: string) => {
    const now = new Date();
    const day = now.getDay();

    if (label === "this-week") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(sunday.toISOString().split("T")[0]);
    } else if (label === "next-week") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7) + 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(sunday.toISOString().split("T")[0]);
    } else if (label === "weekend") {
      const friday = new Date(now);
      friday.setDate(now.getDate() + ((5 - day + 7) % 7));
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      setStartDate(friday.toISOString().split("T")[0]);
      setEndDate(sunday.toISOString().split("T")[0]);
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
          {/* Quick select */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setQuickRange("this-week")}>
              This week
            </Button>
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setQuickRange("next-week")}>
              Next week
            </Button>
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setQuickRange("weekend")}>
              Weekend
            </Button>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {result && (
            <p className={`text-sm rounded-lg p-3 ${result.includes("Failed") ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"}`}>
              {result}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
            className="w-full"
          >
            {loading ? "Generating..." : "Generate Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
