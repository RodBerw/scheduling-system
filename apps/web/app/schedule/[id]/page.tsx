"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScheduleGrid } from "@/components/schedule-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ShiftDialog } from "@/components/shift-dialog";
import { ScheduleHeader } from "@/components/schedule-header";
import { RoleLegend } from "@/components/role-legend";
import { useSchedule, useRequirements, scheduleKeys } from "@/hooks/use-schedules";
import { useShifts, useGenerateShifts, shiftKeys } from "@/hooks/use-shifts";
import type { Shift } from "@/lib/types";
import { toast } from "sonner";

export default function ScheduleDetail() {
  const params = useParams();
  const scheduleId = parseInt(params.id as string);
  const queryClient = useQueryClient();

  const { data: schedule, isLoading: scheduleLoading, error: scheduleError } = useSchedule(scheduleId);
  const { data: shifts = [], dataUpdatedAt: shiftsUpdatedAt } = useShifts(scheduleId);
  const { data: requirements = [] } = useRequirements(scheduleId);
  const generateMutation = useGenerateShifts(scheduleId);

  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [changedShiftIds, setChangedShiftIds] = useState<Set<number>>(new Set());
  const prevShiftsRef = useRef<Shift[]>([]);

  // Detect changed shifts when data updates
  useEffect(() => {
    const prev = prevShiftsRef.current;
    if (prev.length > 0 && shifts.length > 0) {
      const prevMap = new Map(prev.map((p) => [p.id, p]));
      const changed = new Set<number>();
      for (const shift of shifts) {
        const old = prevMap.get(shift.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(shift)) {
          changed.add(shift.id);
        }
      }
      for (const shift of shifts) {
        if (!prevMap.has(shift.id)) changed.add(shift.id);
      }
      if (changed.size > 0) {
        setChangedShiftIds(changed);
        setTimeout(() => setChangedShiftIds(new Set()), 2000);
      }
    }
    prevShiftsRef.current = shifts;
  }, [shiftsUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (requirements.length === 0) {
      toast.error("Set requirements first via the AI chat before generating shifts");
      return;
    }
    try {
      await generateMutation.mutateAsync();
      toast.success("Shifts generated successfully");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || "Failed to generate shifts. Please try again.");
    }
  };

  const handleScheduleChange = () => {
    queryClient.invalidateQueries({ queryKey: shiftKeys.list(scheduleId) });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.requirements(scheduleId) });
  };

  const handleShiftClick = (shiftId: number) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) setSelectedShift(shift);
  };

  const filledCount = shifts.filter((s) => s.assignedEmployeeId).length;
  const unfilledCount = shifts.length - filledCount;

  if (isNaN(scheduleId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Invalid schedule ID</p>
      </div>
    );
  }

  if (scheduleLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground" role="status" aria-live="polite">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3" aria-hidden="true" />
        <p className="text-sm">Loading schedule...</p>
      </div>
    );
  }

  if (scheduleError || !schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">{scheduleError ? "Failed to load schedule data. Is the API server running?" : "Schedule not found"}</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) })} className="cursor-pointer">Retry</Button>
      </div>
    );
  }

  return (
    <TooltipProvider delay={200}>
      <div className="h-screen flex flex-col">
        <ScheduleHeader
          name={schedule.name}
          startDate={schedule.startDate}
          endDate={schedule.endDate}
          filledCount={filledCount}
          unfilledCount={unfilledCount}
          hasShifts={shifts.length > 0}
          hasRequirements={requirements.length > 0}
          isGenerating={generateMutation.isPending}
          chatOpen={chatOpen}
          onGenerate={handleGenerate}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />

        {/* Main: Grid + Chat */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Schedule area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <RoleLegend activeRulesCount={requirements.length} />

            {/* Grid */}
            <div className="flex-1 overflow-auto p-2 sm:p-4">
              <div className="rounded-xl border bg-card overflow-auto">
                <ScheduleGrid
                  shifts={shifts}
                  requirements={requirements}
                  startDate={schedule.startDate}
                  endDate={schedule.endDate}
                  onShiftClick={handleShiftClick}
                  changedShiftIds={changedShiftIds}
                />
              </div>
            </div>
          </div>

          {/* Chat - Desktop (always visible) */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <ChatPanel scheduleId={scheduleId} onScheduleChange={handleScheduleChange} />
          </div>

          {/* Chat - Mobile (overlay) */}
          {chatOpen && (
            <div className="lg:hidden absolute inset-0 z-40 bg-background flex flex-col">
              <ChatPanel scheduleId={scheduleId} onScheduleChange={handleScheduleChange} />
            </div>
          )}
        </div>

        <ShiftDialog
          shift={selectedShift}
          scheduleId={scheduleId}
          onClose={() => setSelectedShift(null)}
          onChanged={handleScheduleChange}
        />
      </div>
    </TooltipProvider>
  );
}
