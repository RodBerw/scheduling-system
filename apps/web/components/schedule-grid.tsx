"use client";

import type { Shift, Period, Role } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PERIODS: Period[] = ["morning", "afternoon", "evening"];

const PERIOD_CONFIG: Record<Period, { label: string; icon: string; time: string }> = {
  morning: { label: "Morning", icon: "AM", time: "6am - 12pm" },
  afternoon: { label: "Afternoon", icon: "PM", time: "12pm - 6pm" },
  evening: { label: "Evening", icon: "NT", time: "6pm - 12am" },
};

const ROLE_CONFIG: Record<Role, { label: string; color: string; dot: string }> = {
  manager: { label: "MGR", color: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  cook: { label: "COOK", color: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  waiter: { label: "WAIT", color: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  dishwasher: { label: "DISH", color: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

function getDays(startDate: string) {
  const days: { date: string; dayName: string; dayNum: number; month: string; isToday: boolean }[] = [];
  const today = new Date().toISOString().split("T")[0];
  const start = new Date(startDate + "T00:00:00");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      dayName: dayNames[d.getDay()],
      dayNum: d.getDate(),
      month: months[d.getMonth()],
      isToday: dateStr === today,
    });
  }
  return days;
}

interface ScheduleGridProps {
  shifts: Shift[];
  startDate: string;
  onShiftClick: (shiftId: number) => void;
}

export function ScheduleGrid({ shifts, startDate, onShiftClick }: ScheduleGridProps) {
  const days = getDays(startDate);

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-2xl">
          <span className="opacity-50">&#x1f4c5;</span>
        </div>
        <div>
          <p className="text-lg font-medium">No schedule yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use the chat to generate a schedule for this week
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-0">
      {/* Header row */}
      <div className="p-3" />
      {days.map((day) => (
        <div
          key={day.date}
          className={`p-3 text-center border-b ${day.isToday ? "bg-primary/5" : ""}`}
        >
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {day.dayName}
          </div>
          <div className={`text-lg font-semibold mt-0.5 ${day.isToday ? "text-primary" : ""}`}>
            {day.dayNum}
          </div>
          <div className="text-[10px] text-muted-foreground">{day.month}</div>
        </div>
      ))}

      {/* Period rows */}
      {PERIODS.map((period) => (
        <>
          {/* Period label */}
          <div
            key={`label-${period}`}
            className="p-3 flex flex-col justify-center items-center border-r border-b"
          >
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {PERIOD_CONFIG[period].icon}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {PERIOD_CONFIG[period].time}
            </span>
          </div>

          {/* Day cells */}
          {days.map((day) => {
            const cellShifts = shifts.filter(
              (s) => s.date === day.date && s.period === period,
            );
            return (
              <div
                key={`${day.date}-${period}`}
                className={`p-1.5 border-b border-r min-h-[100px] ${day.isToday ? "bg-primary/5" : ""}`}
              >
                <div className="flex flex-col gap-1">
                  {cellShifts.map((shift) => {
                    const role = ROLE_CONFIG[shift.role];
                    const isFilled = !!shift.assignedEmployee;

                    return (
                      <Tooltip key={shift.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onShiftClick(shift.id)}
                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition-all ${
                              isFilled
                                ? `${role.color} ring-1 hover:ring-2 cursor-pointer`
                                : "bg-muted/40 text-muted-foreground border border-dashed border-muted-foreground/20 hover:bg-muted/70 cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFilled ? role.dot : "bg-muted-foreground/30"}`} />
                              <span className="font-medium truncate text-[11px]">
                                {shift.assignedEmployee?.name.split(" ")[0] || "Open"}
                              </span>
                            </div>
                            <span className="text-[9px] opacity-70 ml-3">{role.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="font-medium">
                            {shift.assignedEmployee?.name || "Unfilled slot"}
                          </p>
                          <p className="text-xs opacity-80 mt-0.5">
                            {shift.role} &middot; {PERIOD_CONFIG[period].label}
                          </p>
                          {shift.explanation && (
                            <p className="text-xs opacity-60 mt-1">{shift.explanation}</p>
                          )}
                          <p className="text-xs mt-1.5 font-medium">
                            {isFilled ? "Click to replace or reassign" : "Click to assign someone"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}
