"use client";

import { Badge } from "@/components/ui/badge";
import type { Shift, Period } from "@/lib/types";

const PERIODS: Period[] = ["morning", "afternoon", "evening"];
const PERIOD_LABELS: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-purple-100 text-purple-800 border-purple-200",
  cook: "bg-orange-100 text-orange-800 border-orange-200",
  waiter: "bg-blue-100 text-blue-800 border-blue-200",
  dishwasher: "bg-green-100 text-green-800 border-green-200",
};

function getDayLabels(startDate: string): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const start = new Date(startDate + "T00:00:00");
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayNum = d.getDate();
    const month = d.toLocaleString("en", { month: "short" });
    days.push({ date: dateStr, label: `${weekdays[d.getDay()]} ${dayNum} ${month}` });
  }
  return days;
}

interface ScheduleGridProps {
  shifts: Shift[];
  startDate: string;
  onReplace: (shiftId: number) => void;
}

export function ScheduleGrid({ shifts, startDate, onReplace }: ScheduleGridProps) {
  const days = getDayLabels(startDate);

  if (shifts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No schedule generated yet. Use the chat to generate one!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background p-2 text-left font-medium text-muted-foreground w-24">
              Period
            </th>
            {days.map((day) => (
              <th key={day.date} className="p-2 text-center font-medium text-muted-foreground min-w-[140px]">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period} className="border-t">
              <td className="sticky left-0 bg-background p-2 font-medium text-muted-foreground align-top">
                {PERIOD_LABELS[period]}
              </td>
              {days.map((day) => {
                const cellShifts = shifts.filter(
                  (s) => s.date === day.date && s.period === period,
                );
                return (
                  <td key={day.date} className="p-2 align-top border-l">
                    <div className="flex flex-col gap-1">
                      {cellShifts.map((shift) => (
                        <button
                          key={shift.id}
                          onClick={() => shift.assignedEmployeeId && onReplace(shift.id)}
                          className={`text-left rounded-md border px-2 py-1 text-xs transition-colors ${
                            shift.assignedEmployee
                              ? `${ROLE_COLORS[shift.role]} hover:opacity-80 cursor-pointer`
                              : "bg-muted/50 text-muted-foreground border-dashed cursor-default"
                          }`}
                          title={shift.explanation || undefined}
                        >
                          <div className="font-medium truncate">
                            {shift.assignedEmployee?.name || "Unfilled"}
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                            {shift.role}
                          </Badge>
                        </button>
                      ))}
                      {cellShifts.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
