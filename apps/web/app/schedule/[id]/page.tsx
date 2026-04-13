"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScheduleGrid } from "@/components/schedule-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ShiftDialog } from "@/components/shift-dialog";
import { getSchedule, getRequirements } from "@/services/scheduleService";
import { getShifts, generateShifts } from "@/services/shiftService";
import type { Schedule, Shift, ScheduleRequirement } from "@/lib/types";

export default function ScheduleDetail() {
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requirements, setRequirements] = useState<ScheduleRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (isNaN(scheduleId)) return;
    setLoading(true);
    setError(null);
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
      setError("Failed to load schedule data. Is the API server running?");
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateShifts(scheduleId);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setGenerateError(msg || "Failed to generate shifts. Please try again.");
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
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(end + "T00:00:00Z");
    return `${s.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  };

  if (isNaN(scheduleId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Invalid schedule ID</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground" role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Loading...
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">{error || "Schedule not found"}</p>
        <Button variant="outline" onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  return (
    <TooltipProvider delay={200}>
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
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    {filledCount} filled
                  </span>
                  {unfilledCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden="true" />
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
                title={
                  requirements.length === 0
                    ? "Set requirements first via chat"
                    : generating
                      ? "Generating shifts..."
                      : ""
                }
              >
                {generating ? "Generating..." : shifts.length > 0 ? "Regenerate" : "Generate Shifts"}
              </Button>
            </div>
          </div>
          {generateError && (
            <div className="px-6 pb-2">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center justify-between">
                <span>{generateError}</span>
                <button onClick={() => setGenerateError(null)} className="text-destructive hover:underline ml-2">Dismiss</button>
              </div>
            </div>
          )}
        </header>

        {/* Main: Grid + Chat */}
        <div className="flex-1 flex min-h-0">
          {/* Schedule area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Legend */}
            <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
              <div className="flex items-center gap-5">
                <span className="font-medium">Roles</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" aria-hidden="true" /> Manager</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" /> Cook</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" aria-hidden="true" /> Waiter</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" /> Dishwasher</span>
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
