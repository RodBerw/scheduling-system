import type { Schedule } from "@/lib/types";
import { CalendarDays, Users, Clock } from "lucide-react";

interface SummaryStatsProps {
  schedules: Schedule[];
}

export function SummaryStats({ schedules }: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      <div className="bg-card border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <CalendarDays className="w-4 h-4" />
          <span className="text-xs font-medium">Schedules</span>
        </div>
        <p className="text-2xl font-bold">{schedules.length}</p>
      </div>
      <div className="bg-card border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Users className="w-4 h-4" />
          <span className="text-xs font-medium">Filled Shifts</span>
        </div>
        <p className="text-2xl font-bold text-emerald-600">
          {schedules.reduce((a, s) => a + (s.filledShifts ?? 0), 0)}
        </p>
      </div>
      <div className="bg-card border rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium">Open Shifts</span>
        </div>
        <p className="text-2xl font-bold text-amber-600">
          {schedules.reduce((a, s) => a + (s.unfilledShifts ?? 0), 0)}
        </p>
      </div>
    </div>
  );
}
