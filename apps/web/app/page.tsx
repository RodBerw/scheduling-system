"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScheduleGrid } from "@/components/schedule-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ShiftDialog } from "@/components/shift-dialog";
import { GenerateDialog } from "@/components/generate-dialog";
import { getSchedule } from "@/lib/api";
import type { Shift } from "@/lib/types";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatWeekRange(start: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(start + "T00:00:00");
  e.setDate(s.getDate() + 6);
  return `${s.toLocaleDateString("en", { month: "short", day: "numeric" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function Home() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const weekEnd = addDays(weekStart, 6);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      setShifts(await getSchedule(weekStart, weekEnd));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleShiftClick = (shiftId: number) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) setSelectedShift(shift);
  };

  const filledCount = shifts.filter((s) => s.assignedEmployeeId).length;
  const unfilledCount = shifts.length - filledCount;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex flex-col">
        {/* Top Bar */}
        <header className="flex-shrink-0 bg-background border-b z-30">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">RS</span>
              </div>
              <div>
                <h1 className="font-semibold text-sm leading-tight">Restaurant Scheduler</h1>
                <p className="text-xs text-muted-foreground">Workforce Management</p>
              </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                &#8592;
              </Button>
              <button
                onClick={() => setWeekStart(getWeekStart(new Date()))}
                className="text-sm font-medium px-3 py-1 rounded-md hover:bg-muted transition-colors min-w-[180px] text-center"
              >
                {formatWeekRange(weekStart)}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                &#8594;
              </Button>
            </div>

            {/* Actions */}
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
                onClick={() => setGenerateOpen(true)}
                className="h-9"
              >
                Generate Schedule
              </Button>
            </div>
          </div>
        </header>

        {/* Main content: Grid + Chat side by side */}
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
              <span>Click any shift to manage</span>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading schedule...
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <ScheduleGrid
                    shifts={shifts}
                    startDate={weekStart}
                    onShiftClick={handleShiftClick}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Chat panel — always visible */}
          <div className="w-[360px] flex-shrink-0">
            <ChatPanel onScheduleChange={fetchSchedule} />
          </div>
        </div>

        {/* Dialogs */}
        <ShiftDialog
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onChanged={fetchSchedule}
        />
        <GenerateDialog
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          onGenerated={fetchSchedule}
          defaultStart={weekStart}
          defaultEnd={weekEnd}
        />
      </div>
    </TooltipProvider>
  );
}
