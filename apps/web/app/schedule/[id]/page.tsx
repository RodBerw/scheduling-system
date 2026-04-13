"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScheduleGrid } from "@/components/schedule-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ShiftDialog } from "@/components/shift-dialog";
import { getSchedule, getShifts, getRequirements, generateShifts } from "@/lib/api";
import type { Schedule, Shift, ScheduleRequirement } from "@/lib/types";

export default function ScheduleDetail() {
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requirements, setRequirements] = useState<ScheduleRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sh, req] = await Promise.all([
        getSchedule(scheduleId),
        getShifts(scheduleId),
        getRequirements(scheduleId),
      ]);
      setSchedule(s);
      setShifts(sh);
      setRequirements(req);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateShifts(scheduleId);
      fetchData();
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleShiftClick = (shiftId: number) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) setSelectedShift(shift);
  };

  const filledCount = shifts.filter((s) => s.assignedEmployeeId).length;
  const unfilledCount = shifts.length - filledCount;

  const formatRange = (start: string, end: string) => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    return `${s.toLocaleDateString("en", { month: "short", day: "numeric" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Schedule not found</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 bg-background border-b z-30">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                &#8592; Schedules
              </a>
              <div className="w-px h-5 bg-border" />
              <div>
                <h1 className="font-semibold text-sm leading-tight">{schedule.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {formatRange(schedule.startDate, schedule.endDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {shifts.length > 0 && (
                <div className="flex items-center gap-3 mr-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {filledCount} filled
                  </span>
                  {unfilledCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      {unfilledCount} open
                    </span>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating || requirements.length === 0}
                className="h-9"
                title={requirements.length === 0 ? "Set requirements first via chat" : ""}
              >
                {generating ? "Generating..." : shifts.length > 0 ? "Regenerate" : "Generate Shifts"}
              </Button>
            </div>
          </div>
        </header>

        {/* Main: Grid + Chat */}
        <div className="flex-1 flex min-h-0">
          {/* Schedule area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Legend */}
            <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
              <div className="flex items-center gap-5">
                <span className="font-medium">Roles</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" /> Manager</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Cook</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" /> Waiter</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Dishwasher</span>
              </div>
              {requirements.length > 0 && (
                <span>{requirements.length} staffing rules active</span>
              )}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-xl border bg-card overflow-hidden">
                <ScheduleGrid
                  shifts={shifts}
                  requirements={requirements}
                  startDate={schedule.startDate}
                  onShiftClick={handleShiftClick}
                />
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="w-[360px] flex-shrink-0">
            <ChatPanel scheduleId={scheduleId} onScheduleChange={fetchData} />
          </div>
        </div>

        {/* Shift dialog */}
        <ShiftDialog
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onChanged={fetchData}
        />
      </div>
    </TooltipProvider>
  );
}
