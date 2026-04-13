"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScheduleGrid } from "@/components/schedule-grid";
import { ChatPanel } from "@/components/chat-panel";
import { getSchedule, replaceShift } from "@/lib/api";
import type { Shift } from "@/lib/types";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
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
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en", opts)} — ${e.toLocaleDateString("en", { ...opts, year: "numeric" })}`;
}

export default function Home() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  const weekEnd = addDays(weekStart, 6);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSchedule(weekStart, weekEnd);
      setShifts(data);
    } catch {
      console.error("Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleReplace = async (shiftId: number) => {
    try {
      await replaceShift(shiftId);
      fetchSchedule();
    } catch {
      console.error("Failed to replace");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Schedule Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h1 className="text-xl font-bold">Restaurant Scheduler</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered workforce scheduling
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              &larr; Prev
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {formatWeekRange(weekStart)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Next &rarr;
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(getWeekStart(new Date()))}
            >
              Today
            </Button>
          </div>
        </header>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading...
            </div>
          ) : (
            <ScheduleGrid
              shifts={shifts}
              startDate={weekStart}
              onReplace={handleReplace}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-t text-xs text-muted-foreground">
          <span className="font-medium">Roles:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-200" /> Manager
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-200" /> Cook
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200" /> Waiter
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200" /> Dishwasher
          </span>
          <span className="ml-auto">Click an employee to replace them</span>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-[380px] flex-shrink-0">
        <ChatPanel onScheduleChange={fetchSchedule} />
      </div>
    </div>
  );
}
