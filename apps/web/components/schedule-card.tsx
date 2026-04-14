"use client";

import type { Schedule } from "@/lib/types";
import { formatDateRange } from "@/lib/date-utils";
import { CalendarDays, ChevronRight, Trash2, Clock } from "lucide-react";

interface ScheduleCardProps {
  schedule: Schedule;
  onNavigate: (id: number) => void;
  onDelete: (schedule: Schedule) => void;
}

function getCompletionPercent(s: Schedule) {
  const total = s.totalShifts ?? 0;
  if (total === 0) return 0;
  return Math.round(((s.filledShifts ?? 0) / total) * 100);
}

export function ScheduleCard({ schedule: s, onNavigate, onDelete }: ScheduleCardProps) {
  const percent = getCompletionPercent(s);
  const totalShifts = s.totalShifts ?? 0;

  return (
    <a
      href={`/schedule/${s.id}`}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(s.id);
      }}
      className="block p-4 sm:p-5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate">{s.name}</h3>
            {!s.hasRequirements && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                No requirements
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            {formatDateRange(s.startDate, s.endDate)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(s);
            }}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
            aria-label={`Delete schedule ${s.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {totalShifts > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                {s.filledShifts} filled
              </span>
              {(s.unfilledShifts ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                  {s.unfilledShifts} open
                </span>
              )}
            </div>
            <span className="font-semibold text-foreground">{percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent >= 100
                  ? "bg-emerald-500"
                  : percent >= 50
                    ? "bg-amber-400"
                    : "bg-primary/60"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {totalShifts === 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            No shifts generated yet
          </p>
        </div>
      )}
    </a>
  );
}
