"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartDate: string;
  defaultEndDate: string;
  isPending: boolean;
  onCreate: (name: string, startDate: string, endDate: string) => void;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  defaultStartDate,
  defaultEndDate,
  isPending,
  onCreate,
}: CreateScheduleDialogProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // Sync defaults when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName("");
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
          <DialogDescription>Create a new weekly schedule for your restaurant</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-name" className="text-sm font-medium">Name</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Week of April 14"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-sm font-medium">Start date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-sm font-medium">End date</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => onCreate(name, startDate, endDate)}
            disabled={isPending || !name || !startDate || !endDate}
            className="w-full cursor-pointer"
          >
            {isPending ? "Creating..." : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
