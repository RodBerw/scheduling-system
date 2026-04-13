"use client";

import type { Shift, Period, Role, ScheduleRequirement } from "@/lib/types";
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
  const days: { date: string; dayName: string; dayNum: number; month: string; isToday: boolean; dayOfWeek: number }[] = [];
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
      dayOfWeek: d.getDay(),
    });
  }
  return days;
}

interface ScheduleGridProps {
  shifts: Shift[];
  requirements: ScheduleRequirement[];
  startDate: string;
  onShiftClick: (shiftId: number) => void;
}

export function ScheduleGrid({ shifts, requirements, startDate, onShiftClick }: ScheduleGridProps) {
  const days = getDays(startDate);
  const hasShifts = shifts.length > 0;
  const hasReqs = requirements.length > 0;

  if (!hasShifts && !hasReqs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-2xl">
          <span className="opacity-50">&#x1f4c5;</span>
        </div>
        <div>
          <p className="text-lg font-medium">Empty schedule</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Use the chat to set staffing requirements, then generate shifts
          </p>
        </div>
      </div>
    );
  }

  // Helper: get requirement count for a day+period+role
  const getRequired = (dayOfWeek: number, period: Period, role: Role): number => {
    const req = requirements.find(
      (r) => r.dayOfWeek === dayOfWeek && r.period === period && r.role === role,
    );
    return req?.requiredCount ?? 0;
  };

  // Helper: get coverage summary for a cell
  const getCellCoverage = (dayOfWeek: number, period: Period) => {
    const roles: Role[] = ["manager", "cook", "waiter", "dishwasher"];
    let totalRequired = 0;
    let totalFilled = 0;

    for (const role of roles) {
      const required = getRequired(dayOfWeek, period, role);
      totalRequired += required;
    }

    const cellShifts = shifts.filter(
      (s) => new Date(s.date + "T00:00:00").getDay() === dayOfWeek && s.period === period,
    );
    totalFilled = cellShifts.filter((s) => s.assignedEmployeeId).length;

    return { totalRequired, totalFilled };
  };

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

          {days.map((day) => {
            const cellShifts = shifts.filter(
              (s) => s.date === day.date && s.period === period,
            );
            const coverage = hasReqs ? getCellCoverage(day.dayOfWeek, period) : null;

            return (
              <div
                key={`${day.date}-${period}`}
                className={`p-1.5 border-b border-r min-h-[100px] ${day.isToday ? "bg-primary/5" : ""}`}
              >
                {/* Coverage indicator */}
                {coverage && coverage.totalRequired > 0 && (
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span className={`text-[10px] font-medium ${coverage.totalFilled >= coverage.totalRequired
                        ? "text-emerald-600"
                        : coverage.totalFilled > 0
                          ? "text-amber-600"
                          : "text-red-400"
                      }`}>
                      {coverage.totalFilled}/{coverage.totalRequired}
                    </span>
                    {/* Mini progress bar */}
                    <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${coverage.totalFilled >= coverage.totalRequired
                            ? "bg-emerald-500"
                            : coverage.totalFilled > 0
                              ? "bg-amber-500"
                              : "bg-red-300"
                          }`}
                        style={{
                          width: `${Math.min(100, (coverage.totalFilled / coverage.totalRequired) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  {cellShifts.map((shift) => {
                    const role = ROLE_CONFIG[shift.role];
                    const isFilled = !!shift.assignedEmployee;

                    return (
                      <Tooltip key={shift.id}>
                        <TooltipTrigger >
                          <button
                            onClick={() => onShiftClick(shift.id)}
                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition-all ${isFilled
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

                  {/* Show requirement hints when no shifts exist */}
                  {cellShifts.length === 0 && hasReqs && (
                    <div className="text-[10px] text-muted-foreground/60 px-1 py-2">
                      {(["manager", "cook", "waiter", "dishwasher"] as Role[])
                        .map((role) => {
                          const count = getRequired(day.dayOfWeek, period, role);
                          return count > 0 ? `${count} ${ROLE_CONFIG[role].label}` : null;
                        })
                        .filter(Boolean)
                        .join(", ") || "No requirements"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}
