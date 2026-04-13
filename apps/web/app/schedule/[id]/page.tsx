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
import {
  ArrowLeft,
  CalendarDays,
  MessageSquare,
  X,
  Sparkles,
  RefreshCw,
} from "lucide-react";

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
  const [chatOpen, setChatOpen] = useState(false);
  const [changedShiftIds, setChangedShiftIds] = useState<Set<number>>(new Set());
  const [changedReqIds, setChangedReqIds] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async (isRefetch = false) => {
    if (isNaN(scheduleId)) return;
    if (!isRefetch) {
      setLoading(true);
      setError(null);
    }
    try {
      const [s, sh, req] = await Promise.all([
        getSchedule(scheduleId),
        getShifts(scheduleId),
        getRequirements(scheduleId),
      ]);
      if (isRefetch) {
        // Detect changed shifts
        setShifts((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          const changed = new Set<number>();
          for (const shift of sh) {
            const old = prevMap.get(shift.id);
            if (!old || JSON.stringify(old) !== JSON.stringify(shift)) {
              changed.add(shift.id);
            }
          }
          // Also detect new shifts (ids not in prev)
          for (const shift of sh) {
            if (!prevMap.has(shift.id)) changed.add(shift.id);
          }
          if (changed.size > 0) {
            setChangedShiftIds(changed);
            setTimeout(() => setChangedShiftIds(new Set()), 2000);
          }
          return sh;
        });
        // Detect changed requirements
        setRequirements((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          const changed = new Set<number>();
          for (const r of req) {
            const old = prevMap.get(r.id);
            if (!old || JSON.stringify(old) !== JSON.stringify(r)) {
              changed.add(r.id);
            }
          }
          if (changed.size > 0) {
            setChangedReqIds(changed);
            setTimeout(() => setChangedReqIds(new Set()), 2000);
          }
          return req;
        });
        setSchedule(s);
      } else {
        setSchedule(s);
        setShifts(sh);
        setRequirements(req);
      }
    } catch {
      if (!isRefetch) {
        setError("Failed to load schedule data. Is the API server running?");
      }
    } finally {
      if (!isRefetch) {
        setLoading(false);
      }
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
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground" role="status" aria-live="polite">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3" aria-hidden="true" />
        <p className="text-sm">Loading schedule...</p>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">{error || "Schedule not found"}</p>
        <Button variant="outline" onClick={() => fetchData()} className="cursor-pointer">Retry</Button>
      </div>
    );
  }

  return (
    <TooltipProvider delay={200}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b z-30">
          <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <a
                href="/"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0 cursor-pointer"
                aria-label="Back to schedules"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Schedules</span>
              </a>
              <div className="w-px h-5 bg-border hidden sm:block" />
              <div className="min-w-0">
                <h1 className="font-semibold text-sm leading-tight truncate">{schedule.name}</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formatRange(schedule.startDate, schedule.endDate)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {shifts.length > 0 && (
                <div className="hidden sm:flex items-center gap-3 mr-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    {filledCount} filled
                  </span>
                  {unfilledCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
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
                className="h-8 sm:h-9 gap-1.5 text-xs cursor-pointer"
                title={
                  requirements.length === 0
                    ? "Set requirements first via chat"
                    : generating
                      ? "Generating shifts..."
                      : ""
                }
              >
                {generating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {generating ? "Generating..." : shifts.length > 0 ? "Smart Fill" : "Generate Shifts"}
                </span>
                <span className="sm:hidden">
                  {generating ? "..." : "Generate"}
                </span>
              </Button>
              {/* Mobile chat toggle */}
              <Button
                variant={chatOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setChatOpen(!chatOpen)}
                className="lg:hidden h-8 sm:h-9 w-8 sm:w-9 p-0 cursor-pointer"
                aria-label={chatOpen ? "Close chat" : "Open AI assistant"}
              >
                {chatOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          {generateError && (
            <div className="px-3 sm:px-6 pb-2">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center justify-between">
                <span>{generateError}</span>
                <button onClick={() => setGenerateError(null)} className="text-destructive hover:underline ml-2 cursor-pointer">Dismiss</button>
              </div>
            </div>
          )}

          {/* Mobile stats bar */}
          {shifts.length > 0 && (
            <div className="flex sm:hidden items-center gap-3 px-3 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                {filledCount} filled
              </span>
              {unfilledCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                  {unfilledCount} open
                </span>
              )}
            </div>
          )}
        </header>

        {/* Main: Grid + Chat */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Schedule area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Legend */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-3 sm:gap-5">
                <span className="font-medium shrink-0">Roles</span>
                <span className="flex items-center gap-1.5 shrink-0"><span className="w-2 h-2 rounded-full bg-violet-500" aria-hidden="true" /> Manager</span>
                <span className="flex items-center gap-1.5 shrink-0"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" /> Cook</span>
                <span className="flex items-center gap-1.5 shrink-0"><span className="w-2 h-2 rounded-full bg-sky-500" aria-hidden="true" /> Waiter</span>
                <span className="flex items-center gap-1.5 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" /> Dishwasher</span>
              </div>
              {requirements.length > 0 && (
                <span className="shrink-0 hidden sm:inline">{requirements.length} staffing rules active</span>
              )}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-2 sm:p-4">
              <div className="rounded-xl border bg-card overflow-hidden">
                <ScheduleGrid
                  shifts={shifts}
                  requirements={requirements}
                  startDate={schedule.startDate}
                  onShiftClick={handleShiftClick}
                  changedShiftIds={changedShiftIds}
                />
              </div>
            </div>
          </div>

          {/* Chat - Desktop (always visible) */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <ChatPanel scheduleId={scheduleId} onScheduleChange={() => fetchData(true)} />
          </div>

          {/* Chat - Mobile (overlay) */}
          {chatOpen && (
            <div className="lg:hidden absolute inset-0 z-40 bg-background flex flex-col">
              <ChatPanel scheduleId={scheduleId} onScheduleChange={() => fetchData(true)} />
            </div>
          )}
        </div>

        {/* Shift dialog */}
        <ShiftDialog
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onChanged={() => fetchData(true)}
        />
      </div>
    </TooltipProvider>
  );
}
