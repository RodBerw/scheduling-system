"use client";

import type { Shift, Period, Role, ScheduleRequirement } from "@/lib/types";
import { PERIODS, PERIOD_CONFIG, ROLE_CONFIG } from "@/lib/constants";
import { getDays } from "@/lib/date-utils";
import { ShiftCell } from "@/components/shift-cell";
import { CoverageIndicator } from "@/components/coverage-indicator";
import { CalendarDays } from "lucide-react";

interface ScheduleGridProps {
  shifts: Shift[];
  requirements: ScheduleRequirement[];
  startDate: string;
  endDate: string;
  onShiftClick: (shiftId: number) => void;
  changedShiftIds?: Set<number>;
}

export function ScheduleGrid({ shifts, requirements, startDate, endDate, onShiftClick, changedShiftIds }: ScheduleGridProps) {
  const days = getDays(startDate, endDate);
  const colCount = days.length;
  const hasShifts = shifts.length > 0;
  const hasReqs = requirements.length > 0;

  if (!hasShifts && !hasReqs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16 sm:py-20">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-primary/50" />
        </div>
        <div>
          <p className="text-lg font-semibold">Empty schedule</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Use the chat to set staffing requirements, then generate shifts
          </p>
        </div>
      </div>
    );
  }

  const getRequired = (dayOfWeek: number, period: Period, role: Role): number => {
    const req = requirements.find(
      (r) => r.dayOfWeek === dayOfWeek && r.period === period && r.role === role,
    );
    return req?.requiredCount ?? 0;
  };

  const getCellCoverage = (date: string, dayOfWeek: number, period: Period) => {
    const roles: Role[] = ["manager", "cook", "waiter", "dishwasher"];
    let totalRequired = 0;

    for (const role of roles) {
      totalRequired += getRequired(dayOfWeek, period, role);
    }

    const cellShifts = shifts.filter(
      (s) => s.date === date && s.period === period,
    );
    const totalFilled = cellShifts.filter((s) => s.assignedEmployeeId).length;

    return { totalRequired, totalFilled };
  };

  return (
    <div className="grid gap-0" style={{ gridTemplateColumns: `auto repeat(${colCount}, minmax(140px, 1fr))` }}>
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
        <div key={`row-${period}`} className="contents">
          <div className="p-3 flex flex-col justify-center items-center border-r border-b">
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
            const coverage = hasReqs ? getCellCoverage(day.date, day.dayOfWeek, period) : null;

            return (
              <div
                key={`${day.date}-${period}`}
                className={`p-1.5 border-b border-r min-h-[100px] ${day.isToday ? "bg-primary/5" : ""}`}
              >
                {coverage && (
                  <CoverageIndicator filled={coverage.totalFilled} required={coverage.totalRequired} />
                )}

                <div className="flex flex-col gap-1.5">
                  {cellShifts.map((shift) => (
                    <ShiftCell
                      key={shift.id}
                      shift={shift}
                      period={period}
                      isChanged={changedShiftIds?.has(shift.id) ?? false}
                      onClick={() => onShiftClick(shift.id)}
                    />
                  ))}

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
        </div>
      ))}
    </div>
  );
}
